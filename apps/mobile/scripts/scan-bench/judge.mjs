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
