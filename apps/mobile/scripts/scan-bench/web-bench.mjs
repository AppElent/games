/**
 * Measures the web Sudoku scan on the same labelled photos as `bench.mjs`:
 *
 *     node apps/mobile/scripts/scan-bench/web-bench.mjs [--only id,…]
 *       [--cells] [--json file] [--photos folder]
 *
 * It serves the web scan (`src/lib/games/sudoku-scan-image.ts`) with Vite and
 * runs `recognizeGrid` in Playwright's Chromium from the labelled corners.
 * Tesseract's worker, engine and English data come from `node_modules` and the
 * `@tesseract.js-data/eng` package instead of their CDN: Chromium resolves the
 * CDN's host to a local server with a throwaway certificate. Pass that
 * package's folder with `--tessdata` (unpack `npm pack @tesseract.js-data/eng`).
 * Needs Playwright (a global install will do) and openssl.
 */
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createServer as createHttps } from "node:https";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { judge, printTable, summarize, tally } from "./judge.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) =>
	flag(name) ? args[args.indexOf(`--${name}`) + 1] : undefined;

const photos = path.resolve(option("photos") ?? path.join(here, "photos"));
const only = option("only")?.split(",");
const labels = JSON.parse(
	readFileSync(path.join(photos, "labels.json"), "utf8"),
).filter((photo) => !only || only.includes(photo.id));

// Playwright is not a dependency of the repo: a global install will do.
const { chromium } = createRequire(import.meta.url)("playwright");
const require = createRequire(path.join(root, "package.json"));
const tesseract = path.dirname(require.resolve("tesseract.js/package.json"));
const core = path.dirname(
	createRequire(path.join(tesseract, "package.json")).resolve(
		"tesseract.js-core/package.json",
	),
);
const tessdata = option("tessdata");

/** A CDN path of tesseract.js to the file that holds it here. */
function localFile(url) {
	const [, name, rest] =
		url.pathname.match(/^\/npm\/((?:@[^/]+\/)?[^@/]+)(?:@[^/]+)?\/(.*)$/) ?? [];
	if (name === "tesseract.js") return path.join(tesseract, rest);
	if (name === "tesseract.js-core") return path.join(core, rest);
	if (name === "@tesseract.js-data/eng" && tessdata) {
		return path.join(tessdata, rest);
	}
	return null;
}

// The page lives in a scratch folder inside the repo so Vite resolves `#/`.
const page = mkdtempSync(path.join(root, ".scan-bench-web-"));
process.on("exit", () => rmSync(page, { recursive: true, force: true }));
process.on("SIGINT", () => process.exit(130));
writeFileSync(
	path.join(page, "index.html"),
	'<!doctype html><meta charset="utf-8"><script type="module" src="./main.ts"></script>',
);
writeFileSync(
	path.join(page, "main.ts"),
	`import { fileToCanvas, recognizeGrid } from "#/lib/games/sudoku-scan-image";
Object.assign(window, {
	async scanPhoto(url: string, corners: { x: number; y: number }[]) {
		const blob = await (await fetch(url)).blob();
		const bitmap = await createImageBitmap(blob);
		const source = await fileToCanvas(blob);
		const scale = source.width / bitmap.width;
		bitmap.close();
		const placed = corners.map(({ x, y }) => ({ x: x * scale, y: y * scale }));
		return recognizeGrid(source, placed);
	},
});
`,
);

const vite = await createServer({
	configFile: false,
	root: page,
	resolve: {
		tsconfigPaths: true,
		// This checkout's core, also from a worktree that links node_modules.
		alias: {
			"#": path.join(root, "src"),
			"@arcadeclub/core": path.join(root, "packages/core/src"),
		},
	},
	server: { port: 5198, fs: { allow: [root] } },
	logLevel: "error",
});
await vite.listen();

// The worker loads its scripts itself, past Playwright's routing.
execFileSync(
	"openssl",
	[
		"req",
		"-x509",
		"-newkey",
		"rsa:2048",
		"-nodes",
		"-days",
		"1",
		"-subj",
		"/CN=cdn.jsdelivr.net",
		"-keyout",
		path.join(page, "key.pem"),
		"-out",
		path.join(page, "cert.pem"),
	],
	{ stdio: "ignore" },
);
const cdn = createHttps(
	{
		key: readFileSync(path.join(page, "key.pem")),
		cert: readFileSync(path.join(page, "cert.pem")),
	},
	(request, response) => {
		const file = localFile(new URL(request.url, "https://cdn.jsdelivr.net"));
		if (!file || !existsSync(file)) {
			response.writeHead(404).end();
			return;
		}
		const type = file.endsWith(".wasm")
			? "application/wasm"
			: file.endsWith(".js")
				? "text/javascript"
				: "application/octet-stream";
		response
			.writeHead(200, {
				"content-type": type,
				"access-control-allow-origin": "*",
			})
			.end(readFileSync(file));
	},
);
await new Promise((resolve) => cdn.listen(5197, resolve));
const browser = await chromium.launch({
	// A configured proxy would take the CDN's host past the resolver rule.
	proxy: {
		server: "http://127.0.0.1:9",
		bypass: "cdn.jsdelivr.net,localhost,127.0.0.1",
	},
	args: [
		"--host-resolver-rules=MAP cdn.jsdelivr.net 127.0.0.1:5197",
		"--ignore-certificate-errors",
	],
});
try {
	const context = await browser.newContext({ ignoreHTTPSErrors: true });
	const tab = await context.newPage();
	tab.on("pageerror", (error) => console.error(error));
	await tab.goto("http://localhost:5198/");
	await tab.waitForFunction(() => "scanPhoto" in window);
	const all = [];
	const rows = [];
	for (const photo of labels) {
		const url = `/@fs${path.join(photos, `${photo.id}.jpg`)}`;
		const corners = photo.corners.map(([x, y]) => ({ x, y }));
		const started = performance.now();
		const cells = await tab.evaluate(
			([url, corners]) => window.scanPhoto(url, corners),
			[url, corners],
		);
		const ms = Math.round(performance.now() - started);
		const results = cells.map((cell, index) => ({
			photo: photo.id,
			group: photo.kind,
			...judge(photo, index, cell),
		}));
		all.push(...results);
		rows.push({ name: photo.id, ...tally(results), ms });
		if (flag("cells")) {
			const wrong = results.filter(
				(result) => result.kind !== "skip" && !result.right,
			);
			console.log(
				`${photo.id}: ${wrong
					.map(
						({ place, kind, want, found, sure }) =>
							`${place} ${kind} ${want}→${found}${sure ? "!" : ""}`,
					)
					.join("; ")}`,
			);
		}
	}
	summarize(all, rows);
	printTable(rows);
	if (option("json")) {
		writeFileSync(option("json"), JSON.stringify(rows, null, "\t"));
	}
} finally {
	await browser.close();
	cdn.close();
	await vite.close();
}
