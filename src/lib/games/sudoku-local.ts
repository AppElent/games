import type { SudokuDifficulty } from "@arcadeclub/core/sudoku";
import { readJson, writeJson } from "#/lib/games/local-store";

/**
 * Local index of the user's Sudoku sessions so guests (and signed-in
 * players) can keep several puzzles running and resume them later.
 */
export type LocalSudokuSession = {
	sessionId: string;
	title: string;
	difficulty?: SudokuDifficulty;
	source: "generated" | "scan";
	createdAt: number;
};

const KEY = "arcade-club.sudoku.sessions";

export function autoSessionTitle(
	difficulty: SudokuDifficulty | undefined,
	source: "generated" | "scan",
	now = new Date(),
	variant: "classic" | "killer" | "binary" = "classic",
) {
	const stamp = `${now.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	})} ${now.toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	})}`;
	if (source === "scan") {
		return `Scanned sudoku · ${stamp}`;
	}
	const kind =
		variant === "killer"
			? "killer sudoku"
			: variant === "binary"
				? "binary"
				: "sudoku";
	const level = difficulty
		? difficulty[0].toUpperCase() + difficulty.slice(1)
		: "Sudoku";
	return `${level} ${kind} · ${stamp}`;
}

export function listLocalSudokuSessions(): LocalSudokuSession[] {
	const stored = readJson<LocalSudokuSession[]>(KEY, []);
	return Array.isArray(stored) ? stored : [];
}

function save(sessions: LocalSudokuSession[]) {
	writeJson(KEY, sessions.slice(0, 30));
}

export function rememberLocalSudokuSession(session: LocalSudokuSession) {
	const rest = listLocalSudokuSessions().filter(
		(entry) => entry.sessionId !== session.sessionId,
	);
	save([session, ...rest]);
}

export function renameLocalSudokuSession(sessionId: string, title: string) {
	save(
		listLocalSudokuSessions().map((entry) =>
			entry.sessionId === sessionId ? { ...entry, title } : entry,
		),
	);
}

export function forgetLocalSudokuSession(sessionId: string) {
	save(
		listLocalSudokuSessions().filter((entry) => entry.sessionId !== sessionId),
	);
}
