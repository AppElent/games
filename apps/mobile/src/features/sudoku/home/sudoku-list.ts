/**
 * The puzzles on the Sudoku hub. A guest sees the phone's saves. A signed-in
 * player sees their account's sessions (the web's too) merged with this
 * phone's copies, plus the puzzles still waiting to reach the account.
 */

import type { SudokuStatus } from "@arcadeclub/core/sudoku";
import type { Messages } from "../../../i18n";
import { saveTitle } from "../components/puzzle-title";
import type { AccountSession } from "../saves/sudoku-cloud-sync";
import {
	hideSudokuSession,
	removeSudokuSave,
	type SudokuSaveSummary,
} from "../saves/sudoku-save-store";

export type SudokuListRow = {
	/** What `/sudoku/[id]` opens: the phone's save id, or the session id. */
	id: string;
	title: string;
	status: SudokuStatus;
	/** Unknown for a session this phone has no copy of. */
	elapsedSeconds?: number;
	updatedAt: number;
	/** Holds changes the account does not have yet. */
	waitingToSync: boolean;
	/** In the account: removing it only takes it off this phone's list. */
	inAccount: boolean;
	/** The phone's save, when it has one. */
	saveId?: string;
	sessionId?: string;
};

export function buildSudokuList({
	saves,
	sessions,
	hidden,
	signedIn,
	copy,
}: {
	saves: SudokuSaveSummary[];
	sessions: AccountSession[];
	hidden: ReadonlySet<string>;
	signedIn: boolean;
	copy: Messages["games"]["sudoku"];
}): SudokuListRow[] {
	const byId = new Map(sessions.map((entry) => [entry.sessionId, entry]));
	const local = new Set<string>();
	const rows: SudokuListRow[] = saves.map((save) => {
		const sessionId = save.cloud?.sessionId;
		if (sessionId) local.add(sessionId);
		const title =
			(sessionId &&
				byId.get(sessionId as AccountSession["sessionId"])?.title) ||
			saveTitle(copy, save);
		return {
			id: save.id,
			title,
			status: save.status,
			elapsedSeconds: save.elapsedSeconds,
			updatedAt: save.updatedAt,
			waitingToSync: signedIn && !save.cloud?.synced,
			inAccount: Boolean(sessionId),
			saveId: save.id,
			sessionId,
		};
	});
	for (const session of sessions) {
		if (local.has(session.sessionId) || hidden.has(session.sessionId)) continue;
		rows.push({
			id: session.sessionId,
			title: session.title,
			status: session.status === "completed" ? "completed" : "active",
			updatedAt: session.createdAt,
			waitingToSync: false,
			inAccount: true,
			sessionId: session.sessionId,
		});
	}
	return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Takes a row off this phone's list; an account puzzle stays in the account. */
export function removeSudokuRow(row: SudokuListRow) {
	if (row.saveId) {
		removeSudokuSave(row.saveId);
	} else if (row.sessionId) {
		hideSudokuSession(row.sessionId);
	}
}
