// CI half of the mobile distribution standard: after deploy.yml has shipped
// the production backend, publish the merged JavaScript to the daily-driver
// channel, but only where an installed app can load it.
//
//   node apps/mobile/scripts/ci-publish-update.mjs preview
//
// - Skips when nothing the app bundles changed since the last CI publish,
//   which the `mobile-update/<channel>` tag marks. The job moves the tag after
//   publishing, so it needs `contents: write` and a full-history checkout.
// - Publishes when, for at least one platform, a finished EAS build or an
//   earlier update on the channel has this checkout's runtime fingerprint.
//   Local builds (`eas build --local`) are not on EAS; publishing once by hand
//   after installing one seeds the channel.
// - Otherwise it publishes nothing and reports in the run summary that a
//   rebuild is due. It never fails for that reason.
//
// Needs EXPO_TOKEN; SENTRY_AUTH_TOKEN is optional for preview, as in
// publish-update.mjs, which does the actual publish.
import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import {
	appRoot,
	easQuery,
	fingerprint,
	hasFinishedBuild,
	PLATFORMS,
} from "./fingerprint.mjs";

// Everything the mobile bundle is built from, relative to the repo root.
const BUNDLED = [
	"apps/mobile",
	"packages/core",
	"convex/_generated",
	"pnpm-lock.yaml",
	"patches",
];

const channel = process.argv[2];
if (channel !== "preview") {
	console.error("Usage: ci-publish-update.mjs preview");
	process.exit(1);
}
const repoRoot = join(appRoot, "../..");
const tag = `mobile-update/${channel}`;

function summary(line) {
	console.log(line);
	if (process.env.GITHUB_STEP_SUMMARY) {
		appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
	}
}

function git(...args) {
	return spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
}

/** Whether a finished build or an earlier update on the channel has `runtime`. */
function runtimeKnown(platform, runtime) {
	if (hasFinishedBuild(channel, platform, runtime)) return true;
	const updates = easQuery(channel, [
		"update:list",
		"--branch",
		channel,
		"--limit",
		"1",
		"--platform",
		platform,
		"--runtime-version",
		runtime,
	]);
	return (updates.currentPage ?? []).length > 0;
}

const last = git("rev-parse", "--verify", "--quiet", `refs/tags/${tag}`);
if (last.status === 0) {
	const changed = git("diff", "--quiet", last.stdout.trim(), "HEAD", "--", ...BUNDLED);
	if (changed.status === 0) {
		summary(`Mobile ${channel} update: nothing the app bundles changed since \`${tag}\`; skipped.`);
		process.exit(0);
	}
}

const loadable = PLATFORMS.filter((platform) => {
	const runtime = fingerprint(channel, platform).hash;
	const known = runtimeKnown(platform, runtime);
	summary(
		`- ${platform}: runtime \`${runtime.slice(0, 12)}\` ${known ? "is on the channel" : "has no build or update yet"}`,
	);
	return known;
});
if (loadable.length === 0) {
	summary(
		`Mobile ${channel} update: **rebuild due.** No ${channel} build has this runtime, so no installed app would load an update. Build \`preview-internal\`, install it, then publish once by hand.`,
	);
	process.exit(0);
}

const subject = git("log", "-1", "--format=%s (%h)").stdout.trim();
const publish = spawnSync(
	"node",
	[join(appRoot, "scripts/publish-update.mjs"), channel, "--without-build", "--message", subject],
	{ cwd: repoRoot, stdio: "inherit" },
);
if (publish.status !== 0) process.exit(publish.status || 1);

for (const args of [
	["tag", "-f", tag, "HEAD"],
	["push", "-f", "origin", `refs/tags/${tag}`],
]) {
	const result = git(...args);
	if (result.status !== 0) {
		console.error(result.stderr);
		process.exit(result.status || 1);
	}
}
summary(`Mobile ${channel} update: published for ${loadable.join(" and ")}.`);
