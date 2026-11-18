/**
 * "Download my data", the same on web and in the app: page through
 * `account.exportMyData` until it has no `next`, merge the pages per table,
 * and wrap them in one JSON document. The app adds what it keeps only on the
 * phone under `localOnly`.
 */

/** Where the next `exportMyData` page starts. */
export type AccountExportCursor = { source: number; page: string | null };

export type AccountExportPage = {
	tables: Record<string, unknown[]>;
	next: AccountExportCursor | null;
};

export type AccountExport = {
	app: "Arcade Club";
	format: 1;
	exportedAt: string;
	tables: Record<string, unknown[]>;
	localOnly?: Record<string, unknown>;
};

/** Every page of the signed-in account's export, merged per table. */
export async function collectAccountExport(
	fetchPage: (cursor: AccountExportCursor | null) => Promise<AccountExportPage>,
) {
	const tables: Record<string, unknown[]> = {};
	let cursor: AccountExportCursor | null = null;
	do {
		const page: AccountExportPage = await fetchPage(cursor);
		for (const [table, rows] of Object.entries(page.tables)) {
			tables[table] = [...(tables[table] ?? []), ...rows];
		}
		cursor = page.next;
	} while (cursor);
	return tables;
}

export async function buildAccountExport({
	fetchPage,
	now,
	localOnly,
}: {
	fetchPage: (cursor: AccountExportCursor | null) => Promise<AccountExportPage>;
	now: Date;
	localOnly?: Record<string, unknown>;
}): Promise<AccountExport> {
	return {
		app: "Arcade Club",
		format: 1,
		exportedAt: now.toISOString(),
		tables: await collectAccountExport(fetchPage),
		...(localOnly ? { localOnly } : {}),
	};
}

/** `arcade-club-export-YYYY-MM-DD.json`, dated in the player's own time zone. */
export function accountExportFileName(now: Date) {
	const pad = (value: number) => String(value).padStart(2, "0");
	const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	return `arcade-club-export-${date}.json`;
}

export const serializeAccountExport = (data: AccountExport) =>
	JSON.stringify(data, null, 2);
