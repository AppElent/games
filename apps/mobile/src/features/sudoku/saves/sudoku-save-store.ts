/**
 * Solo puzzles saved on this phone: local, offline, never synced.
 *
 * Each puzzle is one local-store entry; a small index of summaries keeps the
 * list screen from parsing every board. Writes are synchronous and cheap, so
 * the game screens save on every move rather than debouncing. When the list
 * outgrows `LIMIT`, solved puzzles are dropped before unfinished ones.
 */
import { parseBinaryGrid } from "@arcadeclub/core/binary-puzzle";
import {
	PUZZLE_DIFFICULTIES,
	type PuzzleDifficulty,
} from "@arcadeclub/core/puzzle";
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
import type { SudokuStatus } from "../components/puzzle-types";

type SaveBase = {
	id: string;
	difficulty: PuzzleDifficulty;
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
};

export type SudokuSave = GridSave | BinarySave;

export type SudokuSaveSummary = Pick<
	SudokuSave,
	"id" | "variant" | "difficulty" | "status" | "elapsedSeconds" | "updatedAt"
>;

const LIMIT = 30;

const includes = (list: readonly string[], value: unknown) =>
	typeof value === "string" && list.includes(value);

function isSummary(value: unknown): value is SudokuSaveSummary {
	const item = value as SudokuSaveSummary | null;
	return (
		typeof item?.id === "string" &&
		includes(SUDOKU_VARIANTS, item.variant) &&
		includes(PUZZLE_DIFFICULTIES, item.difficulty) &&
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
	// Throws on a malformed solution, which `readJson` reads as no save.
	parseGrid(save.solution);
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
	const { id, variant, difficulty, status, elapsedSeconds, updatedAt } = save;
	return { id, variant, difficulty, status, elapsedSeconds, updatedAt };
}

/** Newest first. */
export function listSudokuSaves(): SudokuSaveSummary[] {
	return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readSudokuSave(id: string): SudokuSave | null {
	return readJson(STORAGE_KEYS.sudokuSave(id), (value) => parseSave(id, value));
}

export function writeSudokuSave(save: SudokuSave) {
	writeJson(STORAGE_KEYS.sudokuSave(save.id), save);
	const others = readIndex().filter((item) => item.id !== save.id);
	const index = [summarize(save), ...others];
	while (index.length > LIMIT) {
		const solved = index.findLastIndex((item) => item.status === "completed");
		const [dropped] = index.splice(solved >= 0 ? solved : index.length - 1, 1);
		remove(STORAGE_KEYS.sudokuSave(dropped.id));
	}
	writeJson(STORAGE_KEYS.sudokuIndex, index);
}

export function deleteSudokuSave(id: string) {
	remove(STORAGE_KEYS.sudokuSave(id));
	writeJson(
		STORAGE_KEYS.sudokuIndex,
		readIndex().filter((item) => item.id !== id),
	);
}

export function newSaveId(now = Date.now()) {
	return `${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function sudokuSaveHref(id: string): Href {
	return { pathname: "/sudoku/[id]", params: { id } };
}

/** Puzzles still to finish. Removing one deletes the save. */
export function resumableItems() {
	return listSudokuSaves()
		.filter((save) => save.status !== "completed")
		.map((save) => ({
			id: `sudoku:${save.id}`,
			gameType: "sudoku" as const,
			href: sudokuSaveHref(save.id),
			updatedAt: save.updatedAt,
			remove: () => deleteSudokuSave(save.id),
		}));
}
