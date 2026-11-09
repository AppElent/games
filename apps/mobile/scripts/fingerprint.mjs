// Runtime fingerprints: the value a build and an over-the-air update must
// share before the build loads the update. Computed locally, they match what
// EAS records on a build.
//
//   node apps/mobile/scripts/fingerprint.mjs              # this checkout, per variant
//   node apps/mobile/scripts/fingerprint.mjs diff <base>  # Markdown: what changed vs
//                                                         # another checkout (CI)
//
// `diff` needs `<base>` installed (`pnpm install`), because native modules
// are fingerprinted from node_modules.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const VARIANTS = ["preview", "production", "development"];
export const PLATFORMS = ["ios", "android"];

/** `{ hash, sources }` for one variant and platform of the app at `root`. */
export function fingerprint(variant, platform, root = appRoot) {
	const result = spawnSync(
		"pnpm",
		["exec", "expo-updates", "fingerprint:generate", "--platform", platform],
		{
			cwd: root,
			env: { ...process.env, APP_VARIANT: variant },
			encoding: "utf8",
			maxBuffer: 64 * 1024 * 1024,
		},
	);
	if (result.status !== 0) {
		throw new Error(
			`fingerprint:generate failed in ${root} (${variant}, ${platform}):\n${result.stderr}`,
		);
	}
	return JSON.parse(result.stdout);
}

/**
 * Parsed JSON output of an EAS CLI query, run as the variant `channel`
 * builds. Prints EAS's error and exits when the query fails.
 */
export function easQuery(channel, args) {
	const result = spawnSync(
		"pnpm",
		["exec", "eas", ...args, "--json", "--non-interactive"],
		{
			cwd: appRoot,
			env: { ...process.env, APP_VARIANT: channel },
			encoding: "utf8",
		},
	);
	if (result.status !== 0) {
		console.error(result.stderr);
		process.exit(result.status || 1);
	}
	return JSON.parse(result.stdout);
}

/** Whether a finished EAS build on `channel` for `platform` has `runtime`. */
export function hasFinishedBuild(channel, platform, runtime) {
	const builds = easQuery(channel, [
		"build:list",
		"--channel",
		channel,
		"--platform",
		platform,
		"--runtime-version",
		runtime,
		"--status",
		"finished",
		"--limit",
		"1",
	]);
	return builds.length > 0;
}

/** Readable id: pnpm's store path shortened to `node_modules/<package>/…`. */
function sourceKey(source) {
	return source.type === "contents"
		? source.id
		: source.filePath.replace(/^.*node_modules\//, "node_modules/");
}

/**
 * Source keys whose hash differs, or that exist on one side only. Sources
 * without a hash (an ignored local `ios/` folder) don't count.
 */
function changedSources(before, after) {
	const hashed = (print) => print.sources.filter((s) => s.hash !== null);
	const hashes = new Map(hashed(before).map((s) => [sourceKey(s), s.hash]));
	const changed = new Set();
	for (const source of hashed(after)) {
		const key = sourceKey(source);
		if (hashes.get(key) !== source.hash) changed.add(key);
		hashes.delete(key);
	}
	for (const key of hashes.keys()) changed.add(key);
	return changed;
}

function diff(baseRepo) {
	const repoRoot = spawnSync("git", ["rev-parse", "--show-toplevel"], {
		cwd: appRoot,
		encoding: "utf8",
	}).stdout.trim();
	const baseApp = join(resolve(baseRepo), relative(repoRoot, appRoot));
	if (!existsSync(join(baseApp, "package.json"))) {
		return "### Mobile runtime\n\nThe base branch has no mobile app yet; every build is new.";
	}
	const rows = [];
	const sources = new Set();
	for (const variant of VARIANTS) {
		const cells = PLATFORMS.map((platform) => {
			const before = fingerprint(variant, platform, baseApp);
			const after = fingerprint(variant, platform);
			if (before.hash === after.hash) return "same";
			for (const key of changedSources(before, after)) sources.add(key);
			return "**new runtime**";
		});
		rows.push(`| ${variant} | ${cells.join(" | ")} |`);
	}
	const native = sources.size > 0;
	const lines = [
		"### Mobile runtime",
		"",
		native
			? "This PR changes native code or config. Installed builds won't load its JS as an update: after merging, build `preview-internal` (and production when releasing)."
			: "No native changes. Installed builds can take this PR as an over-the-air update (`pnpm mobile:update:preview`).",
		"",
		"| Variant | iOS | Android |",
		"| --- | --- | --- |",
		...rows,
	];
	if (native) {
		lines.push(
			"",
			"<details><summary>Changed fingerprint sources</summary>",
			"",
			...[...sources].sort().map((key) => `- \`${key}\``),
			"",
			"</details>",
		);
	}
	return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const [command, base] = process.argv.slice(2);
	if (command === "diff" && base) {
		console.log(diff(base));
	} else if (!command) {
		for (const variant of VARIANTS) {
			const hashes = PLATFORMS.map(
				(platform) => `${platform} ${fingerprint(variant, platform).hash}`,
			);
			console.log(`${variant.padEnd(12)} ${hashes.join("  ")}`);
		}
	} else {
		console.error("Usage: fingerprint.mjs [diff <base checkout>]");
		process.exit(1);
	}
}
