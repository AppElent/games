/**
 * Measures the sudoku scan on a labelled photo set, macOS only:
 *
 *     node apps/mobile/scripts/scan-bench/bench.mjs [--only id,…] [--detect]
 *       [--cells] [--json file] [--photos folder] [--turns]
 *
 * It compiles the app's own scan engine (Apple Vision) for the Mac and runs
 * the app's `readGrid` over every photo in `photos/labels.json`, from the
 * labelled grid corners, or with `--detect` from the corners the app finds.
 *
 * `--turns` also turns each photo a quarter, a half and three quarters, hands
 * the scan its corners in the order the turned photo shows them, and checks
 * that `readGrid` and, on a Killer, `readKiller` turn the grid back upright.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { judge, judgeKiller, printTable, summarize, tally } from "./judge.mjs";

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
		turnPhoto: (uri, quarters) => call({ call: "turnPhoto", uri, quarters }),
		warpGrid: async (uri, corners) => {
			const grid = await call({ call: "warpGrid", uri, corners });
			return { ...grid, pixels: new Uint8Array(readFileSync(grid.raw)) };
		},
		readDigits: (uri, boxes) => call({ call: "readDigits", uri, boxes }),
		stop: () => child.stdin.end(),
	};
}

/** Whether the read's top-left corner is the grid's own, of the four. */
function isUpright(read, truth) {
	const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
	const nearest = truth.reduce(
		(best, corner, i) =>
			distance(read[0], corner) < distance(read[0], truth[best]) ? i : best,
		0,
	);
	return nearest === 0;
}

/** The cages a read draws, one letter per cage, as nine rows. */
function cageMap(cages) {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	const map = new Array(81).fill("?");
	cages.forEach((cage, index) => {
		for (const cell of cage.cells) map[cell] = letters[index % letters.length];
	});
	return Array.from({ length: 9 }, (_, row) =>
		map.slice(row * 9, row * 9 + 9).join(""),
	);
}

/**
 * `--killer`: reads the cages and sums of every photo labelled with `cages`,
 * and counts the sums missing or wrong and the cages split or merged.
 */
async function benchKiller(readKiller, killerScanCages) {
	const totals = { cages: 0, missing: 0, wrong: 0, split: 0, merged: 0 };
	console.log(
		"| Photo | Cages | Sums missing | Sums wrong | Cages split | Cages merged | Lines unsure |\n| --- | --- | --- | --- | --- | --- | --- |",
	);
	for (const photo of labels.filter((entry) => entry.cages)) {
		const image = await reader.prepareImage(
			path.join(photos, `${photo.id}.jpg`),
		);
		const corners = flag("detect")
			? await reader.detectGrid(image.uri)
			: photo.corners.map(([x, y]) => ({ x, y }));
		const read = corners
			? await readKiller(reader, image, corners, console.error)
			: null;
		if (!read) {
			console.log(`| ${photo.id} | not read as a Killer | | | | | |`);
			continue;
		}
		const cages = killerScanCages(read.scan);
		const result = judgeKiller(photo, cages);
		totals.cages += result.cages;
		totals.missing += result.missing.length;
		totals.wrong += result.wrong.length;
		totals.split += result.split.length;
		totals.merged += result.merged;
		console.log(
			`| ${photo.id} | ${cages.length}/${result.cages} | ${result.missing.length} | ${result.wrong.length} | ${result.split.length} | ${result.merged} | ${read.scan.doubtful.length} |`,
		);
		if (flag("cells")) {
			console.log(
				`  missing ${result.missing.join("; ")}\n  wrong ${result.wrong.join("; ")}\n  split ${result.split.join("; ")}\n  read cages:\n    ${cageMap(cages).join("\n    ")}`,
			);
		}
	}
	console.log(
		`| total | ${totals.cages} | ${totals.missing} | ${totals.wrong} | ${totals.split} | ${totals.merged} | |`,
	);
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
	const { readGrid, readKiller } = await vite.ssrLoadModule(
		path.join(mobile, "src/features/sudoku/scan/read-grid.ts"),
	);
	const { turnCorners } = await vite.ssrLoadModule(
		path.join(root, "packages/core/src/sudoku-scan-orientation.ts"),
	);
	const { killerScanCages } = await vite.ssrLoadModule(
		path.join(root, "packages/core/src/sudoku-scan-cages.ts"),
	);
	if (flag("killer")) {
		await benchKiller(readKiller, killerScanCages);
	}
	const all = [];
	const rows = [];
	const turns = flag("turns") ? [0, 1, 2, 3] : [0];
	const missedTurns = [];
	const killers = { read: 0, upright: 0, same: 0, missed: [] };
	for (const photo of flag("killer") ? [] : labels) {
		const asTaken = await reader.prepareImage(
			path.join(photos, `${photo.id}.jpg`),
		);
		let uprightCages = null;
		for (const quarters of turns) {
			const name = quarters ? `${photo.id}@${quarters * 90}` : photo.id;
			// With --turns the upright photo is redrawn too, so every turn reads
			// the same pixels.
			const image = flag("turns")
				? await reader.turnPhoto(asTaken.uri, quarters)
				: asTaken;
			// Where the labelled corners are in the turned photo, top-left first.
			const truth = photo.corners.map(([x, y]) => {
				for (let q = 0; q < quarters; q += 1) {
					const height = q % 2 === 0 ? asTaken.height : asTaken.width;
					[x, y] = [height - y, x];
				}
				return { x, y };
			});
			// The corner finder orders corners as the turned photo shows them.
			const corners = flag("detect")
				? await reader.detectGrid(image.uri)
				: turnCorners(truth, 4 - quarters);
			const started = performance.now();
			const read = corners
				? await readGrid(reader, image, corners, () => true, console.error)
				: null;
			const ms = Math.round(performance.now() - started);
			if (!read) {
				console.log(`${name}: no grid found`);
				continue;
			}
			if (!isUpright(read.corners, truth)) missedTurns.push(name);
			if (flag("turns")) {
				const killer = await readKiller(reader, image, corners, console.error);
				if (killer) {
					const cages = killerScanCages(killer.scan).map(
						(cage) => `${cage.cells.join(" ")}=${cage.sum}`,
					);
					if (quarters === 0) uprightCages = cages;
					killers.read += 1;
					if (isUpright(killer.corners, truth)) killers.upright += 1;
					else killers.missed.push(name);
					const differ = [
						...(uprightCages ?? []).filter((cage) => !cages.includes(cage)),
						...cages.filter((cage) => !uprightCages?.includes(cage)),
					];
					if (differ.length === 0) killers.same += 1;
					else if (flag("cells")) {
						console.log(`${name} Killer differs: ${differ.join("; ")}`);
					}
				}
			}
			const results = read.cells.map((cell, index) => ({
				photo: name,
				group: photo.kind,
				...judge(photo, index, cell),
			}));
			all.push(...results);
			rows.push({ name, ...tally(results), ms });
			if (flag("cells")) {
				const wrong = results.filter(
					(result) => result.kind !== "skip" && !result.right,
				);
				console.log(
					`${name}: ${wrong
						.map(
							({ place, kind, want, found, sure }) =>
								`${place} ${kind} ${want}→${found}${sure ? "!" : ""}`,
						)
						.join("; ")}`,
				);
			}
		}
	}
	if (!flag("killer")) {
		summarize(all, rows);
		printTable(rows);
	}
	if (flag("turns")) {
		const count = labels.length * 4;
		console.log(
			`Turned back upright: ${count - missedTurns.length}/${count}${missedTurns.length ? ` (missed ${missedTurns.join(", ")})` : ""}`,
		);
		console.log(
			`Killer reads turned back upright: ${killers.upright}/${killers.read}, same cages and sums as upright: ${killers.same}/${killers.read}${killers.missed.length ? ` (missed ${killers.missed.join(", ")})` : ""}`,
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
