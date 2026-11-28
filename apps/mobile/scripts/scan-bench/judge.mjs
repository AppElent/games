/**
 * How the scan benches judge a read: each labelled cell against the cell the
 * scan made of it, and the totals a bench prints.
 */
const notesMask = (digits) =>
	[...digits].reduce((mask, digit) => mask | (1 << Number(digit)), 0);

/** One labelled cell against the cell the scan read. */
export function judge(photo, index, cell) {
	const row = Math.floor(index / 9);
	const col = index % 9;
	const place = `${row + 1},${col + 1}`;
	if (photo.cutOff?.includes(place) || photo.unreadable?.includes(place)) {
		return { kind: "skip" };
	}
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

export function tally(results) {
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
		// The player checks these for nothing.
		rightFlagged: filled.filter((result) => result.right && !result.sure)
			.length,
		emptyAsDigit: of("empty").filter((result) => result.asDigit).length,
		emptyAsNotes: of("empty").filter(
			(result) => !result.right && !result.asDigit,
		).length,
	};
}

/** Totals per photo group and overall, after the per-photo rows. */
export function summarize(all, rows) {
	for (const kind of ["clean", "curled", "handwritten"]) {
		const group = all.filter((result) => result.group === kind);
		if (group.length > 0) rows.push({ name: `all ${kind}`, ...tally(group) });
	}
	rows.push({ name: "total", ...tally(all) });
}

export function printTable(rows) {
	console.log(
		"| Photo | Right | Printed | Handwritten | Type right | Wrong, unflagged | Right, flagged | Empty read as digit | Empty read as notes |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
	);
	for (const row of rows) {
		console.log(
			`| ${row.name} | ${row.right}/${row.cells} | ${row.printedRight}/${row.printed} | ${row.writtenRight}/${row.written} | ${row.typeRight} | ${row.wrongSure} | ${row.rightFlagged} | ${row.emptyAsDigit} | ${row.emptyAsNotes} |`,
		);
	}
}

/**
 * A Killer read against its labels: `cages` is nine rows of nine letters, one
 * letter per cage, and `sums` each cage's sum by its first cell (`row,column`).
 * `read` is `killerScanCages` of the scan: cells 0-80 and the sum or null.
 */
export function judgeKiller(photo, read) {
	const letters = photo.cages.join("");
	const truth = new Map();
	[...letters].forEach((letter, cell) => {
		truth.set(letter, [...(truth.get(letter) ?? []), cell]);
	});
	const place = (cell) => `${Math.floor(cell / 9) + 1},${(cell % 9) + 1}`;
	const cageOf = new Map();
	read.forEach((cage, index) => {
		for (const cell of cage.cells) cageOf.set(cell, index);
	});
	const missing = [];
	const wrong = [];
	const split = [];
	for (const cells of truth.values()) {
		const first = place(cells[0]);
		const want = photo.sums[first];
		const parts = new Set(cells.map((cell) => cageOf.get(cell)));
		if (parts.size > 1) split.push(first);
		const cage = read[cageOf.get(cells[0])];
		// The sum is judged on the read cage that starts at the cage's first cell.
		const found = cage.cells[0] === cells[0] ? cage.sum : null;
		if (found === null) missing.push(first);
		else if (found !== want) wrong.push(`${first} ${want}→${found}`);
	}
	const merged = read.filter(
		(cage) => new Set(cage.cells.map((cell) => letters[cell])).size > 1,
	).length;
	return { cages: truth.size, missing, wrong, split, merged };
}
