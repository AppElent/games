/**
 * Measures the sudoku scan on a labelled photo set, macOS only:
 *
 *     node apps/mobile/scripts/scan-bench/bench.mjs [--only id,…] [--detect]
 *       [--cells] [--json file] [--photos folder]
 *
 * It compiles the app's own scan engine (Apple Vision) for the Mac and runs
 * the app's `readGrid` over every photo in `photos/labels.json`, from the
 * labelled grid corners, or with `--detect` from the corners the app finds.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const mobile = path.join(root, "apps/mobile");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) =>
	flag(name) ? args[args.indexOf(`--${name}`) + 1] : undefined;

const photos = path.resolve(option("photos") ?? path.join(here, "photos"));
const only = option("only")?.split(",");
const labels = JSON.parse(
	readFileSync(path.join(photos, "labels.json"), "utf8"),
).filter((photo) => !only || only.includes(photo.id));

function startReader(folder) {
	const tool = path.join(folder, "reader");
	// swiftc allows top-level code in a file named main.swift only.
	const main = path.join(folder, "main.swift");
	writeFileSync(main, readFileSync(path.join(here, "reader.swift")));
	execFileSync("swiftc", [
		"-O",
		"-o",
		tool,
		main,
		path.join(mobile, "modules/sudoku-scanner/ios/SudokuScanEngine.swift"),
	]);
	const child = spawn(tool, [folder], { stdio: ["pipe", "pipe", "inherit"] });
	const waiting = [];
	createInterface({ input: child.stdout }).on("line", (line) => {
		const { resolve, reject } = waiting.shift();
		const reply = JSON.parse(line);
		if (reply.error) reject(new Error(reply.error));
		else resolve(reply.value);
	});
	const call = (request) =>
		new Promise((resolve, reject) => {
			waiting.push({ resolve, reject });
			child.stdin.write(`${JSON.stringify(request)}\n`);
		});
	return {
		prepareImage: (uri) => call({ call: "prepareImage", uri }),
		detectGrid: (uri) => call({ call: "detectGrid", uri }),
		warpGrid: async (uri, corners) => {
			const grid = await call({ call: "warpGrid", uri, corners });
			return { ...grid, pixels: new Uint8Array(readFileSync(grid.raw)) };
		},
		readDigits: (uri, boxes) => call({ call: "readDigits", uri, boxes }),
		stop: () => child.stdin.end(),
	};
}

const notesMask = (digits) =>
	[...digits].reduce((mask, digit) => mask | (1 << Number(digit)), 0);

/** One labelled cell against the cell the scan read. */
function judge(photo, index, cell) {
	const row = Math.floor(index / 9);
	const col = index % 9;
	const place = `${row + 1},${col + 1}`;
	if (photo.cutOff?.includes(place)) return { kind: "skip" };
	const printed = photo.printed[row][col];
	const written = photo.handwritten[row][col];
	const notes = photo.notes?.[place];
	const digitType = cell.type === "given" || cell.type === "userDigit";
	const found = digitType ? cell.digit : 0;
	const sure = cell.confidence >= 0.7;
	if (notes) {
		const mask = cell.cornerMask | cell.centerMask;
		return {
			kind: "notes",
			right: !digitType && mask === notesMask(notes),
			place,
			want: notes,
			found: digitType ? found : `n${mask}`,
			sure,
		};
	}
	if (printed === "." && written === ".") {
		return {
			kind: "empty",
			right: cell.type === "empty",
			asDigit: digitType && found !== 0,
			place,
			want: ".",
			found: cell.type === "empty" ? "." : digitType ? found : "n",
			sure,
		};
	}
	const want = Number(printed !== "." ? printed : written);
	return {
		kind: printed !== "." ? "printed" : "written",
		right: found === want,
		typeRight:
			found === want && cell.type === (printed !== "." ? "given" : "userDigit"),
		place,
		want,
		found: digitType ? found : cell.type === "empty" ? "." : "n",
		sure,
	};
}

function tally(results) {
	const of = (kind) => results.filter((result) => result.kind === kind);
	const right = (list) => list.filter((result) => result.right).length;
	const filled = [...of("printed"), ...of("written"), ...of("notes")];
	return {
		cells: filled.length,
		right: right(filled),
		printed: of("printed").length,
		printedRight: right(of("printed")),
		written: of("written").length,
		writtenRight: right(of("written")),
		typeRight: filled.filter((result) => result.typeRight).length,
		// Wrong digits the verifier does not flag are the costly ones.
		wrongSure: filled.filter(
			(result) =>
				!result.right && typeof result.found === "number" && result.sure,
		).length,
		emptyAsDigit: of("empty").filter((result) => result.asDigit).length,
		emptyAsNotes: of("empty").filter(
			(result) => !result.right && !result.asDigit,
		).length,
	};
}

const folder = mkdtempSync(path.join(tmpdir(), "scan-bench-"));
const vite = await createServer({
	configFile: false,
	root,
	server: { middlewareMode: true, hmr: false, ws: false },
	appType: "custom",
	logLevel: "error",
	optimizeDeps: { noDiscovery: true },
});
const reader = startReader(folder);
try {
	const { readGrid } = await vite.ssrLoadModule(
		path.join(mobile, "src/features/sudoku/scan/read-grid.ts"),
	);
	const all = [];
	const rows = [];
	for (const photo of labels) {
		const image = await reader.prepareImage(
			path.join(photos, `${photo.id}.jpg`),
		);
		const corners = flag("detect")
			? await reader.detectGrid(image.uri)
			: photo.corners.map(([x, y]) => ({ x, y }));
		const started = performance.now();
		const read = corners
			? await readGrid(reader, image.uri, corners, () => true)
			: null;
		const ms = Math.round(performance.now() - started);
		if (!read) {
			console.log(`${photo.id}: no grid found`);
			continue;
		}
		const results = read.cells.map((cell, index) => ({
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
	for (const kind of ["clean", "curled", "handwritten"]) {
		const group = all.filter((result) => result.group === kind);
		if (group.length > 0) rows.push({ name: `all ${kind}`, ...tally(group) });
	}
	rows.push({ name: "total", ...tally(all) });
	console.log(
		"| Photo | Right | Printed | Handwritten | Type right | Wrong, unflagged | Empty read as digit | Empty read as notes |\n| --- | --- | --- | --- | --- | --- | --- | --- |",
	);
	for (const row of rows) {
		console.log(
			`| ${row.name} | ${row.right}/${row.cells} | ${row.printedRight}/${row.printed} | ${row.writtenRight}/${row.written} | ${row.typeRight} | ${row.wrongSure} | ${row.emptyAsDigit} | ${row.emptyAsNotes} |`,
		);
	}
	if (option("json")) {
		writeFileSync(option("json"), JSON.stringify(rows, null, "\t"));
	}
} finally {
	reader.stop();
	await vite.close();
	rmSync(folder, { recursive: true, force: true });
}
