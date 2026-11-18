import type { SudokuDifficulty, SudokuVariant } from "@arcadeclub/core/sudoku";
import { readJson, writeJson } from "#/lib/games/local-store";

/**
 * Local index of the user's Sudoku sessions so guests (and signed-in
 * players) can keep several puzzles running and resume them later. A
 * signed-in player's list also shows their account's sessions, including
 * ones started in the app (`withAccountSudokuSessions`).
 */
export type LocalSudokuSession = {
	sessionId: string;
	title: string;
	difficulty?: SudokuDifficulty;
	source: "generated" | "scan";
	createdAt: number;
};

const KEY = "arcade-club.sudoku.sessions";
/** Account sessions removed from this browser's list. */
const HIDDEN_KEY = "arcade-club.sudoku.hidden";
const HIDDEN_LIMIT = 200;

export function autoSessionTitle(
	difficulty: SudokuDifficulty | undefined,
	source: "generated" | "scan",
	now = new Date(),
	variant: SudokuVariant = "classic",
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

function listHidden(): string[] {
	const stored = readJson<unknown>(HIDDEN_KEY, []);
	return Array.isArray(stored)
		? stored.filter((item): item is string => typeof item === "string")
		: [];
}

/**
 * Takes a puzzle off this browser's list. An account puzzle stays in the
 * account; it is only hidden here.
 */
export function forgetLocalSudokuSession(sessionId: string) {
	save(
		listLocalSudokuSessions().filter((entry) => entry.sessionId !== sessionId),
	);
	writeJson(
		HIDDEN_KEY,
		[sessionId, ...listHidden().filter((id) => id !== sessionId)].slice(
			0,
			HIDDEN_LIMIT,
		),
	);
}

/** One of the account's sessions, as `sessions.listParticipation` returns it. */
type AccountRow = {
	session: {
		_id: string;
		_creationTime: number;
		gameType: string;
		title: string;
		status: string;
	};
};

/**
 * This browser's list plus the account's sudoku sessions it does not hold
 * yet (started in the app or another browser), newest first.
 */
export function withAccountSudokuSessions(
	local: LocalSudokuSession[],
	rows: AccountRow[],
): LocalSudokuSession[] {
	const known = new Set(local.map((entry) => entry.sessionId));
	const hidden = new Set(listHidden());
	const account = rows
		.filter(
			({ session }) =>
				session.gameType === "sudoku" &&
				session.status !== "cancelled" &&
				!known.has(session._id) &&
				!hidden.has(session._id),
		)
		.map(
			({ session }): LocalSudokuSession => ({
				sessionId: session._id,
				title: session.title,
				source: "generated",
				createdAt: session._creationTime,
			}),
		);
	return [...local, ...account].sort((a, b) => b.createdAt - a.createdAt);
}
