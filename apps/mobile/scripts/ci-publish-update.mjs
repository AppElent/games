// CI half of the release standard (developer-home standards/releases.md):
// publish main's JavaScript to an update channel, but only where an
// installed app can load it.
//
//   node apps/mobile/scripts/ci-publish-update.mjs gate preview         # deploy.yml, every merge
//   node apps/mobile/scripts/ci-publish-update.mjs publish preview
//   node apps/mobile/scripts/ci-publish-update.mjs gate production      # daily, mobile-update-production.yml
//   node apps/mobile/scripts/ci-publish-update.mjs publish production
//
// The decision and the publish are two steps, so a skipped update shows as a
// skipped "Publish … update" step in the Actions run (the developer-home
// changelog reads that): `gate` decides and sets the step output
// `publish=true|false`, with what to publish in `$RUNNER_TEMP`; `publish`
// (run only when the gate said so) publishes, then moves the tag. A gate
// that fails (an EAS error, an unknown commit) fails the run.
//
// Both channels:
// - Skip when nothing the app bundles changed since the last CI publish,
//   which the `ota-<channel>` tag marks. The job moves the tag after
//   publishing, so it needs `contents: write` and a full-history checkout.
// - Publish only for the platforms where a finished EAS build or an earlier
//   update on the channel has the runtime fingerprint. Otherwise publish
//   nothing and say in the run summary that a build is due. Never fail for
//   that reason.
//
// `preview` publishes this checkout (HEAD), after deploy.yml shipped the
// production backend it calls.
//
// `production` publishes the newest commit that has been on the preview
// channel for at least 24 hours (so it soaked on the owner's phone). It
// skips when:
// - `OTA_PRODUCTION_HOLD` is set (the owner's stop switch, a repo variable);
// - a newer preview update is a rollback (preview was rolled back, so the
//   soaked commit is suspect);
// - production already runs that commit or something newer: the latest
//   `production` update or the newest `v*` store-build tag is not an
//   ancestor of it (a hand hotfix or a store build is never downgraded);
// - the production backend (`$PRODUCTION_ORIGIN/version`) does not run that
//   commit or a later one.
// It checks the commit out in a worktree and publishes with the worktree's
// own publish-update.mjs, so the bundle is exactly what preview ran. A
// runtime no production build has means a store build is due; that always
// waits for the owner, so the job only reports it.
//
// Needs EXPO_TOKEN. SENTRY_AUTH_TOKEN is optional for preview and required
// for production, as in publish-update.mjs, which does the actual publish.
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	PLATFORMS as ALL_PLATFORMS,
	appRoot,
	easQuery,
	fingerprint,
	hasFinishedBuild,
} from "./fingerprint.mjs";
import { otaMessage } from "./ota-message.mjs";

// Android is paused until the repository variable ANDROID_ENABLED is `true`;
// the workflows pass it in (developer-home standards/releases.md, "Android pause").
const PLATFORMS = ALL_PLATFORMS.filter(
	(platform) =>
		platform !== "android" || process.env.ANDROID_ENABLED === "true",
);

// Everything the mobile bundle is built from, relative to the repo root.
const BUNDLED = [
	"apps/mobile",
	"packages/core",
	"convex/_generated",
	"pnpm-lock.yaml",
	"patches",
];
const SOAK_MS = 24 * 60 * 60 * 1000;
/** Preview update groups looked at for a soaked commit, newest first (EAS max). */
const SOAK_LOOKBACK = 50;

const [mode, channel] = process.argv.slice(2);
if (
	(mode !== "gate" && mode !== "publish") ||
	(channel !== "preview" && channel !== "production")
) {
	console.error(
		"Usage: ci-publish-update.mjs <gate|publish> <preview|production>",
	);
	process.exit(1);
}
const repoRoot = join(appRoot, "../..");
const tag = `ota-${channel}`;
// Before the release standard the preview tag was mobile-update/preview.
const legacyTags = channel === "preview" ? ["mobile-update/preview"] : [];

/** What the gate hands the publish step: `{ commit, platforms, root }`. */
const stateFile = join(
	process.env.RUNNER_TEMP ?? tmpdir(),
	`ota-gate-${channel}.json`,
);

function summary(line) {
	console.log(line);
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
	}
}

function setOutput(name, value) {
	if (process.env.GITHUB_OUTPUT) {
		appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
	}
}

/** Ends the gate with nothing to publish: the Publish step is skipped. */
function skip(line) {
	summary(line);
	setOutput("publish", "false");
	process.exit(0);
}

/** Ends the gate with an update to publish: `root` is a checkout of `commit`. */
function proceed(state) {
	writeFileSync(stateFile, JSON.stringify(state));
	setOutput("publish", "true");
	process.exit(0);
}

function git(...args) {
	return spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

function gitOrExit(...args) {
	const result = git(...args);
	if (result.status !== 0) {
		console.error(result.stderr);
		process.exit(result.status || 1);
	}
	return result.stdout.trim();
}

function isAncestor(older, newer) {
	return git("merge-base", "--is-ancestor", older, newer).status === 0;
}

/** The commit the channel's tag (or its legacy name) points at, if any. */
function lastPublished() {
	for (const name of [tag, ...legacyTags]) {
		const found = git(
			"rev-parse",
			"--verify",
			"--quiet",
			`refs/tags/${name}^{commit}`,
		);
		if (found.status === 0) return found.stdout.trim();
	}
	return null;
}

/** Whether a finished build or an earlier update on the channel has `runtime`. */
function runtimeKnown(platform, runtime) {
	if (hasFinishedBuild(channel, platform, runtime)) return true;
	// Fails while the channel's branch has never had an update.
	const updates = easQuery(
		channel,
		[
			"update:list",
			"--branch",
			channel,
			"--limit",
			"1",
			"--platform",
			platform,
			"--runtime-version",
			runtime,
		],
		{ optional: true },
	);
	return (updates?.currentPage ?? []).length > 0;
}

/** First update of an update group (`createdAt`, `gitCommitHash`, …), or `null`. */
function viewGroup(channelName, group) {
	const updates = easQuery(channelName, ["update:view", group], {
		interactiveFlag: false,
		optional: true,
	});
	return updates?.[0] ?? null;
}

/**
 * Per platform, the commit of the newest non-rollback update on the
 * `production` branch (`{ ios?, android? }`; a platform without one is
 * missing). Platforms can differ: a hotfix may have gone to one only. Fails
 * closed: any EAS error other than a missing branch stops the run, so a
 * flaky query never hides a hotfix.
 */
function latestProductionCommits() {
	const list = easQuery(
		"production",
		["update:list", "--branch", "production", "--limit", "25"],
		{ optional: (stderr) => /Could not find (a )?branch/.test(stderr) },
	);
	const shipped = {};
	for (const { group, isRollBackToEmbedded } of list?.currentPage ?? []) {
		if (PLATFORMS.every((platform) => platform in shipped)) break;
		if (isRollBackToEmbedded) continue;
		const updates = easQuery("production", ["update:view", group], {
			interactiveFlag: false,
		});
		for (const update of updates) {
			if (!update.gitCommitHash || update.isRollBackToEmbedded) continue;
			if (!(update.platform in shipped)) {
				shipped[update.platform] = update.gitCommitHash;
			}
		}
	}
	return shipped;
}

/** The commit of the newest `v<version>` store-build tag, or `null`. */
function latestStoreBuildCommit() {
	const tags = git(
		"tag",
		"--list",
		"v[0-9]*",
		"--sort=-v:refname",
	).stdout.trim();
	const [newest] = tags ? tags.split("\n") : [];
	return newest ? gitOrExit("rev-parse", `${newest}^{commit}`) : null;
}

/**
 * The newest commit published to preview at least 24 hours ago that is on
 * main, or `{ skip }` with the reason there is none. Update groups list
 * newest first; a rollback newer than the candidate stops the search.
 */
function soakedPreviewCommit(now) {
	const groups =
		easQuery("preview", [
			"update:list",
			"--branch",
			"preview",
			"--limit",
			String(SOAK_LOOKBACK),
		]).currentPage ?? [];
	for (const { group, isRollBackToEmbedded } of groups) {
		if (isRollBackToEmbedded) {
			return {
				skip: "preview was rolled back after the last soaked update; fix forward on preview first",
			};
		}
		const update = viewGroup("preview", group);
		if (!update) continue;
		if (update.isRollBackToEmbedded) {
			return {
				skip: "preview was rolled back after the last soaked update; fix forward on preview first",
			};
		}
		if (!update.gitCommitHash) continue;
		if (now - Date.parse(update.createdAt) < SOAK_MS) continue;
		if (
			git("cat-file", "-e", `${update.gitCommitHash}^{commit}`).status !== 0
		) {
			continue;
		}
		if (!isAncestor(update.gitCommitHash, "HEAD")) continue;
		return { commit: update.gitCommitHash, publishedAt: update.createdAt };
	}
	return { skip: "nothing on preview has soaked for 24 hours yet" };
}

/** The commit production's `/version` reports. */
async function productionCommit() {
	const origin = process.env.PRODUCTION_ORIGIN;
	if (!origin) {
		console.error("PRODUCTION_ORIGIN is not set.");
		process.exit(1);
	}
	const response = await fetch(new URL("/version", origin), {
		headers: { "cache-control": "no-cache" },
	});
	if (!response.ok) {
		console.error(`${origin}/version answered ${response.status}.`);
		process.exit(1);
	}
	const { commit } = await response.json();
	return typeof commit === "string" ? commit : null;
}

/** Skips when `commit` bundles nothing new since the channel's last CI publish. */
function skipIfUnchanged(commit) {
	const last = lastPublished();
	if (!last) return;
	if (commit !== last && isAncestor(commit, last)) {
		skip(
			`Mobile ${channel} update: \`${commit.slice(0, 7)}\` is older than \`${tag}\` (\`${last.slice(0, 7)}\`); skipped.`,
		);
	}
	if (git("diff", "--quiet", last, commit, "--", ...BUNDLED).status === 0) {
		skip(
			`Mobile ${channel} update: nothing the app bundles changed since \`${tag}\`; skipped.`,
		);
	}
}

/** Platforms with a build or update on the channel for `root`'s runtime. */
function loadablePlatforms(root) {
	return PLATFORMS.filter((platform) => {
		const runtime = fingerprint(channel, platform, root).hash;
		const known = runtimeKnown(platform, runtime);
		summary(
			`- ${platform}: runtime \`${runtime.slice(0, 12)}\` ${known ? "is on the channel" : "has no build or update yet"}`,
		);
		return known;
	});
}

function moveTag(commit) {
	gitOrExit("tag", "-f", tag, commit);
	gitOrExit("push", "-f", "origin", `refs/tags/${tag}`);
}

/** Runs `publish-update.mjs` from `root` (a checkout of the commit). */
function publish(root, commit, platforms) {
	// The message is passed in, not left to the checkout's own publish-update.mjs:
	// a production commit older than the OTA label has no such default.
	const args = [
		join(root, "apps/mobile/scripts/publish-update.mjs"),
		channel,
		"--without-build",
		"--message",
		otaMessage(join(root, "apps/mobile"), commit),
	];
	if (platforms.length === 1) args.push("--platform", platforms[0]);
	const result = spawnSync("node", args, { cwd: root, stdio: "inherit" });
	return result.status ?? 1;
}

/** Preview: this checkout (HEAD), once its bundle changed and a build can load it. */
function gatePreview() {
	const head = gitOrExit("rev-parse", "HEAD");
	skipIfUnchanged(head);
	const loadable = loadablePlatforms(appRoot);
	if (loadable.length === 0) {
		skip(
			"Mobile preview update: **rebuild due.** No preview build has this runtime, so no installed app would load an update. Build `preview-internal`, install it, then publish once by hand.",
		);
	}
	proceed({ commit: head, platforms: loadable, root: repoRoot });
}

/** Production: the newest commit that soaked on preview, checked out in a worktree. */
async function gateProduction() {
	if (process.env.OTA_PRODUCTION_HOLD) {
		skip(
			`Mobile production update: on hold (\`OTA_PRODUCTION_HOLD\`: ${process.env.OTA_PRODUCTION_HOLD}); skipped.`,
		);
	}
	const soaked = soakedPreviewCommit(Date.now());
	if (soaked.skip) {
		skip(`Mobile production update: ${soaked.skip}; skipped.`);
	}
	const { commit, publishedAt } = soaked;
	summary(
		`Mobile production update: candidate \`${commit.slice(0, 7)}\`, on preview since ${publishedAt}.`,
	);
	skipIfUnchanged(commit);

	// Never move a platform backwards: past a hand-published hotfix, or past
	// the JS a newer store build embeds. Each platform is checked on its own.
	const productionCommits = latestProductionCommits();
	const storeBuild = latestStoreBuildCommit();
	const eligible = PLATFORMS.filter((platform) => {
		const checks = [
			[`the latest ${platform} production update`, productionCommits[platform]],
			["the newest store build tag", storeBuild],
		];
		for (const [what, shipped] of checks) {
			if (!shipped) continue;
			if (git("cat-file", "-e", `${shipped}^{commit}`).status !== 0) {
				summary(
					`Mobile production update: ${what} is commit \`${shipped.slice(0, 7)}\`, which is not on this repository's history (published from an unpushed branch?). The owner must decide; failing.`,
				);
				process.exit(1);
			}
			if (shipped === commit && what.includes("update")) {
				summary(`- ${platform}: already runs \`${commit.slice(0, 7)}\``);
				return false;
			}
			if (!isAncestor(shipped, commit)) {
				summary(
					`- ${platform}: ${what} (\`${shipped.slice(0, 7)}\`) is not older than \`${commit.slice(0, 7)}\`; skipped`,
				);
				return false;
			}
		}
		return true;
	});
	if (eligible.length === 0) {
		if (PLATFORMS.every((platform) => productionCommits[platform] === commit)) {
			moveTag(commit);
		}
		skip(
			`Mobile production update: no platform needs \`${commit.slice(0, 7)}\`; skipped.`,
		);
	}

	const running = await productionCommit();
	if (!running || !isAncestor(commit, running)) {
		skip(
			`Mobile production update: the production backend runs \`${(running ?? "unknown").slice(0, 7)}\`, not \`${commit.slice(0, 7)}\` or later; skipped.`,
		);
	}

	const worktree = join(process.env.RUNNER_TEMP ?? "/tmp", "ota-production");
	git("worktree", "remove", "--force", worktree);
	gitOrExit("worktree", "add", "--detach", worktree, commit);
	const install = spawnSync("pnpm", ["install", "--frozen-lockfile"], {
		cwd: worktree,
		stdio: "inherit",
	});
	if (install.status !== 0) process.exit(install.status || 1);

	const loadable = loadablePlatforms(join(worktree, "apps/mobile")).filter(
		(platform) => eligible.includes(platform),
	);
	if (loadable.length === 0) {
		skip(
			"Mobile production update: **store build due.** No production build has this runtime, so no installed app would load an update. Propose a store release on a decision card.",
		);
	}
	proceed({ commit, platforms: loadable, root: worktree });
}

/** Publishes what the gate decided, then moves the tag. */
function publishFromGate() {
	const { commit, platforms, root } = JSON.parse(
		readFileSync(stateFile, "utf8"),
	);
	const status = publish(root, commit, platforms);
	if (status !== 0) {
		if (channel === "production") {
			// The update may be live with only the maps upload failed: then keep
			// the tag in step, and retry the maps with --upload-only by hand.
			const after = latestProductionCommits();
			if (platforms.some((platform) => after[platform] === commit)) {
				moveTag(commit);
				summary(
					`Mobile production update: published \`${commit.slice(0, 7)}\`, but the publish step failed after it (source maps?). Retry with \`pnpm mobile:update:production --upload-only\` from that commit.`,
				);
			}
		}
		process.exit(status);
	}
	moveTag(commit);
	summary(
		channel === "preview"
			? `Mobile preview update: published for ${platforms.join(" and ")}.`
			: `Mobile production update: published \`${commit.slice(0, 7)}\` for ${platforms.join(" and ")}.`,
	);
}

if (mode === "publish") publishFromGate();
else if (channel === "preview") gatePreview();
else await gateProduction();
