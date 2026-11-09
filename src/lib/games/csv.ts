/** Escapes a CSV cell per RFC 4180. */
function csvCell(value: string | number): string {
	const text = String(value);
	if (/[",\n\r]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

export function toCsv(rows: (string | number)[][]): string {
	return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Triggers a client-side download of CSV content. */
export function downloadCsv(filename: string, csv: string) {
	const blob = new Blob([`﻿${csv}`], {
		type: "text/csv;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
