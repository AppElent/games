/**
 * The AppElent account portal contract (`standards/account-portal.md`,
 * contract 1): what account.appelent.nl reads to show, export and, later,
 * delete one person's Arcade Club data. Each function resolves the caller
 * from the Clerk token and wraps the in-app export (`lib/accountExport.ts`)
 * and deletion blocker (`lib/accountDeletion.ts`); none takes a user id or
 * writes anything. `deleteAppData` follows with APP-392.
 */
import type { AccountExportCursor } from "@arcadeclub/core/account-export";
import { v } from "convex/values";
import type { TableNames } from "./_generated/dataModel";
import { query } from "./_generated/server";
import {
	ACTIVE_GAME_WINDOW_MINUTES,
	inActiveGame,
} from "./lib/accountDeletion";
import {
	exportPage as accountExportPage,
	EXPORT_SOURCES,
	ownerRows,
} from "./lib/accountExport";
import { getOptionalUserId } from "./lib/auth";
import { gameError } from "./lib/errors";

const CONTRACT = 1 as const;
const APP = "arcade" as const;
/** Rows a count reads at most; one more tells "1,000 or more" apart. */
const COUNT_CAP = 1000;

/**
 * The portal's key per table the export reads by owner (`ownerRows`). Keys
 * are stable: the portal owns their labels per locale. `accountPortal.test.ts`
 * fails until a new owner table has one here.
 */
export const COUNT_KEYS: Partial<Record<TableNames, string>> = {
	sessionParticipants: "gameSeats",
	contentDrafts: "drafts",
	quizSets: "quizSets",
};

const countValidator = v.object({
	key: v.string(),
	count: v.number(),
	more: v.boolean(),
});

/**
 * Whether the caller has data here, and how much per kind, in display order.
 * Null for a caller who never used Arcade Club. Arcade Club keeps no
 * per-account record of the latest write, so `lastActiveAt` is null.
 */
export const summary = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			contract: v.literal(CONTRACT),
			lastActiveAt: v.null(),
			counts: v.array(countValidator),
		}),
	),
	handler: async (ctx) => {
		const userId = await getOptionalUserId(ctx);
		if (!userId) return null;
		const counts = await Promise.all(
			ownerRows(ctx.db, userId).map(async ([table, rows]) => {
				const read = (await rows.take(COUNT_CAP + 1)).length;
				return {
					key: COUNT_KEYS[table] ?? table,
					count: Math.min(read, COUNT_CAP),
					more: read > COUNT_CAP,
				};
			}),
		);
		if (counts.every(({ count }) => count === 0)) return null;
		return { contract: CONTRACT, lastActiveAt: null, counts };
	},
});

/**
 * Why the portal may not delete the caller's Arcade Club data right now:
 * a seat in a game other players are in, as `deleteMyData` refuses it.
 */
export const deletionBlocker = query({
	args: {},
	returns: v.union(
		v.null(),
		v.object({
			code: v.literal("accountInActiveGame"),
			params: v.object({ minutes: v.number() }),
		}),
	),
	handler: async (ctx) => {
		const userId = await getOptionalUserId(ctx);
		if (!userId || !(await inActiveGame(ctx, userId, Date.now()))) return null;
		return {
			code: "accountInActiveGame" as const,
			params: { minutes: ACTIVE_GAME_WINDOW_MINUTES },
		};
	},
});

/**
 * One page of the caller's export, the same rows as the in-app "Download my
 * data". `cursor` is null for the first page, then the previous page's
 * `next`, until that is null. The cursor is the in-app export's own cursor
 * as JSON; the portal never parses it.
 */
export const exportPage = query({
	args: { cursor: v.union(v.string(), v.null()) },
	returns: v.object({
		contract: v.literal(CONTRACT),
		app: v.literal(APP),
		tables: v.record(v.string(), v.array(v.any())),
		next: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, { cursor }) => {
		const empty = { contract: CONTRACT, app: APP, tables: {}, next: null };
		const userId = await getOptionalUserId(ctx);
		if (!userId) return empty;
		const at = cursor === null ? null : parseCursor(cursor);
		if (at === null && !(await hasOwnerRows(ctx.db, userId))) return empty;
		const page = await accountExportPage(ctx, userId, at);
		return {
			contract: CONTRACT,
			app: APP,
			tables: page.tables,
			next: page.next === null ? null : JSON.stringify(page.next),
		};
	},
});

async function hasOwnerRows(
	db: Parameters<typeof ownerRows>[0],
	userId: string,
) {
	for (const [, rows] of ownerRows(db, userId)) {
		if ((await rows.first()) !== null) return true;
	}
	return false;
}

/** The in-app cursor inside a portal cursor, or a keyed error. */
function parseCursor(cursor: string): AccountExportCursor {
	let parsed: unknown;
	try {
		parsed = JSON.parse(cursor);
	} catch {
		throw gameError("accountExportCursorInvalid");
	}
	if (
		typeof parsed === "object" &&
		parsed !== null &&
		Object.keys(parsed).length === 2 &&
		"source" in parsed &&
		"page" in parsed &&
		Number.isInteger(parsed.source) &&
		(parsed.source as number) >= 0 &&
		(parsed.source as number) < EXPORT_SOURCES &&
		(parsed.page === null || typeof parsed.page === "string")
	) {
		return { source: parsed.source as number, page: parsed.page };
	}
	throw gameError("accountExportCursorInvalid");
}
