import type { SudokuDifficulty } from "./sudoku";

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

export function listLocalSudokuSessions(
	storage: Storage = window.localStorage,
): LocalSudokuSession[] {
	try {
		const raw = storage.getItem(KEY);
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as LocalSudokuSession[];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function save(sessions: LocalSudokuSession[], storage: Storage) {
	storage.setItem(KEY, JSON.stringify(sessions.slice(0, 30)));
}

export function rememberLocalSudokuSession(
	session: LocalSudokuSession,
	storage: Storage = window.localStorage,
) {
	const rest = listLocalSudokuSessions(storage).filter(
		(entry) => entry.sessionId !== session.sessionId,
	);
	save([session, ...rest], storage);
}

export function renameLocalSudokuSession(
	sessionId: string,
	title: string,
	storage: Storage = window.localStorage,
) {
	save(
		listLocalSudokuSessions(storage).map((entry) =>
			entry.sessionId === sessionId ? { ...entry, title } : entry,
		),
		storage,
	);
}

export function forgetLocalSudokuSession(
	sessionId: string,
	storage: Storage = window.localStorage,
) {
	save(
		listLocalSudokuSessions(storage).filter(
			(entry) => entry.sessionId !== sessionId,
		),
		storage,
	);
}
