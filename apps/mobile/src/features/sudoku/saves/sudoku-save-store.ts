/**
 * Solo puzzles saved on this phone (decided for v1: local, offline, no sync).
 *
 * Each puzzle is one kv-store entry; a small index of summaries keeps the
 * list screen from parsing every board. Writes are synchronous and cheap, so
 * the game screens save on every move rather than debouncing. When the list
 * outgrows `LIMIT`, solved puzzles are dropped before unfinished ones.
 */
import type { BinaryDifficulty } from "@games/core/binary-puzzle";
import type { SudokuDifficulty } from "@games/core/sudoku";
import type { SerializedSudokuBoard } from "@games/core/sudoku-board";
import type { KillerCage } from "@games/core/sudoku-killer";
import Storage from "expo-sqlite/kv-store";

export type SudokuVariant = "classic" | "killer" | "binary";
export type SudokuStatus = "active" | "paused" | "completed";

type SaveBase = {
	id: string;
	difficulty: SudokuDifficulty & BinaryDifficulty;
	createdAt: number;
	updatedAt: number;
	elapsedSeconds: number;
	status: SudokuStatus;
};

export type GridSave = SaveBase & {
	variant: "classic" | "killer";
	board: SerializedSudokuBoard;
	solution: string;
	cages?: KillerCage[];
	autoCleanup: boolean;
};

export type BinarySave = SaveBase & {
	variant: "binary";
	size: number;
	givens: string;
	entries: string;
	solution: string;
};

export type SudokuSave = GridSave | BinarySave;

export type SudokuSaveSummary = Pick<
	SudokuSave,
	"id" | "variant" | "difficulty" | "status" | "elapsedSeconds" | "updatedAt"
>;

const INDEX_KEY = "arcade:sudoku:index";
const saveKey = (id: string) => `arcade:sudoku:save:${id}`;
const LIMIT = 30;

function readJson(key: string): unknown {
	try {
		const raw = Storage.getItemSync(key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function writeJson(key: string, value: unknown) {
	try {
		Storage.setItemSync(key, JSON.stringify(value));
	} catch {
		// Best effort: a full or locked store loses this write, not the game.
	}
}

function isSummary(value: unknown): value is SudokuSaveSummary {
	const item = value as SudokuSaveSummary | null;
	return (
		typeof item?.id === "string" &&
		typeof item.variant === "string" &&
		typeof item.updatedAt === "number"
	);
}

function readIndex(): SudokuSaveSummary[] {
	const parsed = readJson(INDEX_KEY);
	return Array.isArray(parsed) ? parsed.filter(isSummary) : [];
}

function summarize(save: SudokuSave): SudokuSaveSummary {
	const { id, variant, difficulty, status, elapsedSeconds, updatedAt } = save;
	return { id, variant, difficulty, status, elapsedSeconds, updatedAt };
}

/** Newest first. */
export function listSudokuSaves(): SudokuSaveSummary[] {
	return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readSudokuSave(id: string): SudokuSave | null {
	const parsed = readJson(saveKey(id)) as SudokuSave | null;
	return parsed && parsed.id === id && typeof parsed.variant === "string"
		? parsed
		: null;
}

export function writeSudokuSave(save: SudokuSave) {
	writeJson(saveKey(save.id), save);
	const others = readIndex().filter((item) => item.id !== save.id);
	const index = [summarize(save), ...others];
	while (index.length > LIMIT) {
		const solved = index.findLastIndex((item) => item.status === "completed");
		const [dropped] = index.splice(solved >= 0 ? solved : index.length - 1, 1);
		removeEntry(dropped.id);
	}
	writeJson(INDEX_KEY, index);
}

function removeEntry(id: string) {
	try {
		Storage.removeItemSync(saveKey(id));
	} catch {
		// Orphaned entries are harmless: nothing lists them.
	}
}

export function deleteSudokuSave(id: string) {
	removeEntry(id);
	writeJson(
		INDEX_KEY,
		readIndex().filter((item) => item.id !== id),
	);
}

export function newSaveId(now = Date.now()) {
	return `${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
