/**
 * Solo puzzles saved on this phone.
 *
 * Each puzzle is one local-store entry; a small index of summaries keeps the
 * list screen from parsing every board. Writes are synchronous and cheap, so
 * the game screens save on every move rather than debouncing.
 *
 * A guest's puzzles stay on the phone. A signed-in player's puzzles carry a
 * `cloud` link: the account they belong to, the Convex session once
 * `sudoku.create` confirmed it, and whether the phone holds changes the
 * server has not confirmed yet (`sudoku-cloud-sync.ts` sends them). The
 * store owns that link: a game screen's write keeps the stored link and only
 * marks it unsynced, so a screen opened before the session existed never
 * drops its id.
 *
 * When the list outgrows `LIMIT`, solved puzzles are dropped before
 * unfinished ones, and a puzzle with changes still to send is never dropped.
 */
import { parseBinaryGrid } from "@arcadeclub/core/binary-puzzle";
import {
	PUZZLE_DIFFICULTIES,
	type PuzzleDifficulty,
} from "@arcadeclub/core/puzzle";
import type { SudokuStatus } from "@arcadeclub/core/sudoku";
import {
	parseGrid,
	SUDOKU_CELL_COUNT,
	SUDOKU_STATUSES,
	SUDOKU_VARIANTS,
} from "@arcadeclub/core/sudoku";
import type { SerializedSudokuBoard } from "@arcadeclub/core/sudoku-board";
import type { KillerCage } from "@arcadeclub/core/sudoku-killer";
import type { Href } from "expo-router";
import {
	readJson,
	remove,
	STORAGE_KEYS,
	writeJson,
} from "../../../storage/local-store";

/** Where a signed-in player's puzzle stands with their account. */
export type CloudLink = {
	/** The Clerk user id of the account the puzzle belongs to. */
	userId: string;
	/** The Convex session, once `sudoku.create` confirmed it. */
	sessionId?: string;
	/** False while this phone holds changes the server has not confirmed. */
	synced: boolean;
	/** When a `create` was sent whose answer has not come back yet. */
	createStartedAt?: number;
	/** The session's title, as sent with `create` or read from the server. */
	title?: string;
};

type SaveBase = {
	id: string;
	/** Absent for a scanned puzzle, which has none. */
	difficulty?: PuzzleDifficulty;
	/** Set when the puzzle was read from a photo; absent for a generated one. */
	source?: "scan";
	updatedAt: number;
	elapsedSeconds: number;
	status: SudokuStatus;
	cloud?: CloudLink;
};

export type GridSave = SaveBase & {
	variant: "classic" | "killer";
	board: SerializedSudokuBoard;
	/**
	 * Absent for a scanned puzzle, and for one from the account: the server
	 * never sends it.
	 */
	solution?: string;
	cages?: KillerCage[];
	autoCleanup: boolean;
};

export type BinarySave = SaveBase & {
	variant: "binary";
	size: number;
	givens: string;
	entries: string;
};

export type SudokuSave = GridSave | BinarySave;

export type SudokuSaveSummary = Pick<
	SudokuSave,
	| "id"
	| "variant"
	| "difficulty"
	| "source"
	| "status"
	| "elapsedSeconds"
	| "updatedAt"
	| "cloud"
>;

const LIMIT = 30;
/** Hidden account puzzles remembered; older ones may come back to the list. */
const HIDDEN_LIMIT = 200;

const includes = (list: readonly string[], value: unknown) =>
	typeof value === "string" && list.includes(value);

function isCloudLink(value: unknown): value is CloudLink {
	const link = value as CloudLink | null;
	return (
		typeof link?.userId === "string" &&
		typeof link.synced === "boolean" &&
		(link.sessionId === undefined || typeof link.sessionId === "string") &&
		(link.createStartedAt === undefined ||
			typeof link.createStartedAt === "number") &&
		(link.title === undefined || typeof link.title === "string")
	);
}

const fromAccount = (item: { cloud?: CloudLink }) =>
	item.cloud?.sessionId !== undefined;

/** A puzzle that may lack a difficulty and a solution. */
const scannedOrFromAccount = (item: { source?: "scan"; cloud?: CloudLink }) =>
	item.source === "scan" || fromAccount(item);

function isSummary(value: unknown): value is SudokuSaveSummary {
	const item = value as SudokuSaveSummary | null;
	if (typeof item?.id !== "string") return false;
	if (item.cloud !== undefined && !isCloudLink(item.cloud)) return false;
	if (item.source !== undefined && item.source !== "scan") return false;
	return (
		includes(SUDOKU_VARIANTS, item.variant) &&
		(includes(PUZZLE_DIFFICULTIES, item.difficulty) ||
			(item.difficulty === undefined && scannedOrFromAccount(item))) &&
		includes(SUDOKU_STATUSES, item.status) &&
		typeof item.elapsedSeconds === "number" &&
		typeof item.updatedAt === "number"
	);
}

const isNumberList = (value: unknown): value is number[] =>
	Array.isArray(value) && value.every((item) => typeof item === "number");

const isCellList = (value: unknown) =>
	isNumberList(value) && value.length === SUDOKU_CELL_COUNT;

const isDigitString = (value: unknown) =>
	typeof value === "string" && /^\d+$/.test(value);

function isGridSave(save: GridSave) {
	const { board, cages } = save;
	if (save.solution !== undefined || !scannedOrFromAccount(save)) {
		// Throws on a malformed solution, which `readJson` reads as no save.
		parseGrid(save.solution ?? "");
	}
	return (
		typeof save.autoCleanup === "boolean" &&
		isDigitString(board?.givens) &&
		board.givens.length === SUDOKU_CELL_COUNT &&
		isDigitString(board.digits) &&
		board.digits.length === SUDOKU_CELL_COUNT &&
		isCellList(board.corner) &&
		isCellList(board.center) &&
		isCellList(board.colors) &&
		(cages === undefined ||
			(Array.isArray(cages) &&
				cages.every(
					(cage) => typeof cage?.sum === "number" && isNumberList(cage.cells),
				)))
	);
}

function isBinarySave(save: BinarySave) {
	if (!Number.isInteger(save.size)) return false;
	// Each throws on a malformed grid, which `readJson` reads as no save.
	parseBinaryGrid(save.givens, save.size);
	parseBinaryGrid(save.entries, save.size);
	return true;
}

/** The save stored under `id`, if the game screens could open it. */
function parseSave(id: string, value: unknown): SudokuSave | null {
	if (!isSummary(value) || value.id !== id) return null;
	const save = value as SudokuSave;
	const playable =
		save.variant === "binary" ? isBinarySave(save) : isGridSave(save);
	return playable ? save : null;
}

function readIndex(): SudokuSaveSummary[] {
	return (
		readJson(STORAGE_KEYS.sudokuIndex, (value) =>
			Array.isArray(value) ? value.filter(isSummary) : null,
		) ?? []
	);
}

function summarize(save: SudokuSave): SudokuSaveSummary {
	const { id, variant, difficulty, source, status, elapsedSeconds, updatedAt } =
		save;
	return {
		id,
		variant,
		difficulty,
		...(source && { source }),
		status,
		elapsedSeconds,
		updatedAt,
		cloud: save.cloud,
	};
}

/** The account a save belongs to; null for a guest's. */
const ownerOf = (item: { cloud?: CloudLink }) => item.cloud?.userId ?? null;

/** Changes this phone still has to send; never dropped to make room. */
export const hasUnsentChanges = (item: { cloud?: CloudLink }) =>
	item.cloud !== undefined && !item.cloud.synced;

/**
 * The puzzles `owner` sees, newest first: a guest (null) sees the phone's
 * guest saves; a signed-in player their account's, plus the guest saves
 * about to become theirs. Another account's saves stay hidden on a shared
 * phone.
 */
export function listSudokuSaves(
	owner: string | null = null,
): SudokuSaveSummary[] {
	return readIndex()
		.filter((item) => {
			const of = ownerOf(item);
			return of === owner || (owner !== null && of === null);
		})
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readSudokuSave(id: string): SudokuSave | null {
	return readJson(STORAGE_KEYS.sudokuSave(id), (value) => parseSave(id, value));
}

/** This phone's copy of an account session, if it holds one. */
export function findSudokuSaveBySession(sessionId: string): SudokuSave | null {
	const item = readIndex().find(
		(entry) => entry.cloud?.sessionId === sessionId,
	);
	return item ? readSudokuSave(item.id) : null;
}

/**
 * For the data export: what the account export cannot hold yet, newest
 * first. That is the phone's guest saves and `owner`'s puzzles that have no
 * session yet; a synced puzzle is in the account's own export.
 */
export function readLocalOnlySudokuSaves(owner: string | null): SudokuSave[] {
	return readIndex()
		.filter(
			(item) =>
				!fromAccount(item) &&
				(ownerOf(item) === null || ownerOf(item) === owner),
		)
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.flatMap((item) => readSudokuSave(item.id) ?? []);
}

export type SaveChange = "game" | "sync";

const listeners = new Set<(change: SaveChange) => void>();

/**
 * Called after every write: `game` for a move or a new puzzle (the sync
 * sends it), `sync` for what the sync itself stored (the list redraws).
 */
export function onSudokuSaveWritten(listener: (change: SaveChange) => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function emit(change: SaveChange) {
	for (const listener of listeners) listener(change);
}

function store(save: SudokuSave, change: SaveChange) {
	writeJson(STORAGE_KEYS.sudokuSave(save.id), save);
	const others = readIndex().filter((item) => item.id !== save.id);
	const index = [summarize(save), ...others];
	while (index.length > LIMIT) {
		const droppable = (item: SudokuSaveSummary) => !hasUnsentChanges(item);
		const solved = index.findLastIndex(
			(item) => item.status === "completed" && droppable(item),
		);
		const oldest = index.findLastIndex(droppable);
		const at = solved >= 0 ? solved : oldest;
		if (at < 0) break;
		const [dropped] = index.splice(at, 1);
		remove(STORAGE_KEYS.sudokuSave(dropped.id));
	}
	writeJson(STORAGE_KEYS.sudokuIndex, index);
	emit(change);
}

/**
 * A game screen's write: the board, clock and status as they are now. The
 * stored cloud link wins over the one in `save`, and an account puzzle is
 * marked as holding unsent changes. `updatedAt` never goes backwards, so the
 * sync can tell a write that landed while it was sending.
 */
export function writeSudokuSave(save: SudokuSave) {
	const stored = readSudokuSave(save.id);
	const link = stored ? stored.cloud : save.cloud;
	store(
		{
			...save,
			updatedAt: Math.max(save.updatedAt, (stored?.updatedAt ?? 0) + 1),
			cloud: link && { ...link, synced: false },
		},
		"game",
	);
}

/** The sync's write: the save as the server now has it, or its new link. */
export function storeSyncedSave(save: SudokuSave) {
	store(save, "sync");
}

/** Changes the cloud link of a stored save, leaving the board alone. */
export function updateCloudLink(
	id: string,
	change: (link: CloudLink) => CloudLink,
): SudokuSave | null {
	const save = readSudokuSave(id);
	if (!save?.cloud) return null;
	const next = { ...save, cloud: change(save.cloud) };
	store(next, "sync");
	return next;
}

/** Marks `id` synced, unless a write landed after the one that was sent. */
export function markSynced(id: string, sentUpdatedAt: number) {
	const save = readSudokuSave(id);
	if (!save?.cloud || save.updatedAt !== sentUpdatedAt) return;
	store({ ...save, cloud: { ...save.cloud, synced: true } }, "sync");
}

/**
 * The phone's guest saves become `userId`'s, to be uploaded once. Nothing is
 * removed: each stays on the phone as that account's copy.
 */
export function adoptGuestSaves(userId: string) {
	for (const item of readIndex()) {
		if (ownerOf(item) !== null) continue;
		const save = readSudokuSave(item.id);
		if (save) store({ ...save, cloud: { userId, synced: false } }, "sync");
	}
}

/** After the account is deleted: its puzzles leave the phone too. */
export function forgetAccountSaves(userId: string) {
	for (const item of readIndex()) {
		if (ownerOf(item) === userId) deleteSudokuSave(item.id);
	}
}

export function deleteSudokuSave(id: string) {
	remove(STORAGE_KEYS.sudokuSave(id));
	writeJson(
		STORAGE_KEYS.sudokuIndex,
		readIndex().filter((item) => item.id !== id),
	);
}

function readHidden(): string[] {
	return (
		readJson(STORAGE_KEYS.sudokuHidden, (value) =>
			Array.isArray(value)
				? value.filter((item): item is string => typeof item === "string")
				: null,
		) ?? []
	);
}

/** Account sessions removed from this phone's list. */
export function hiddenSudokuSessions(): ReadonlySet<string> {
	return new Set(readHidden());
}

export function hideSudokuSession(sessionId: string) {
	const rest = readHidden().filter((item) => item !== sessionId);
	writeJson(
		STORAGE_KEYS.sudokuHidden,
		[sessionId, ...rest].slice(0, HIDDEN_LIMIT),
	);
}

/**
 * Removes a puzzle from this phone's list. An account puzzle stays in the
 * account (the web lists it too); only this phone stops showing it.
 */
export function removeSudokuSave(id: string) {
	const save = readSudokuSave(id);
	if (save?.cloud?.sessionId) hideSudokuSession(save.cloud.sessionId);
	deleteSudokuSave(id);
}

export function newSaveId(now = Date.now()) {
	return `${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function sudokuSaveHref(id: string): Href {
	return { pathname: "/sudoku/[id]", params: { id } };
}

/** `owner`'s puzzles still to finish. Removing one takes it off the list. */
export function resumableItems(owner: string | null = null) {
	return listSudokuSaves(owner)
		.filter((save) => save.status !== "completed")
		.map((save) => ({
			id: `sudoku:${save.id}`,
			gameType: "sudoku" as const,
			href: sudokuSaveHref(save.id),
			updatedAt: save.updatedAt,
			remove: () => removeSudokuSave(save.id),
		}));
}
