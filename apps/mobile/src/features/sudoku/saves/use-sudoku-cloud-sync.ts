/**
 * Keeps a signed-in player's puzzles flowing to their account while the app
 * runs: once Convex holds their token, whenever the app comes to the
 * foreground, and shortly after each game write. A guest's saves stay on the
 * phone; they become the account's (and upload once) when the player signs
 * in. Mounted once, at the root, so a puzzle finished offline is sent even
 * when the player never reopens Sudoku.
 */
import { useAuth } from "@clerk/expo";
import { useConvex } from "convex/react";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { api } from "../../../convex/api";
import { useI18n } from "../../../i18n";
import { reportError } from "../../../observability/report";
import { usePlayerIdentity } from "../../players/identity/use-player-identity";
import { useBackendAuthReady } from "../../sessions/use-backend-auth-ready";
import { puzzleTitle } from "../components/puzzle-title";
import {
	createSyncRunner,
	type SudokuCloud,
	type SyncAccount,
	sudokuSessionsOf,
	syncSudokuSaves,
} from "./sudoku-cloud-sync";
import { onSudokuSaveWritten } from "./sudoku-save-store";

/** Quiet time after a move before it is sent; the phone already holds it. */
const SEND_DELAY_MS = 1500;

/**
 * One runner for the whole app, so a run left over from an earlier sign-in
 * can never send a second `create` beside the next one.
 */
let current: { account: SyncAccount; cloud: SudokuCloud } | null = null;
const runner = createSyncRunner(async () => {
	const config = current;
	if (config) {
		await syncSudokuSaves(config.account, config.cloud, {
			onError: reportError,
		});
	}
});

export function useSudokuCloudSync() {
	const convex = useConvex();
	const { userId } = useAuth();
	const { ready } = useBackendAuthReady();
	const { displayName } = usePlayerIdentity();
	const { t } = useI18n();
	// Read at send time, so a rename or a language change does not restart it.
	const latest = useRef({ displayName, copy: t.games.sudoku, userId });
	latest.current = { displayName, copy: t.games.sudoku, userId };

	useEffect(() => {
		if (!ready || !userId) return;
		let active = true;
		current = {
			account: {
				userId,
				get displayName() {
					return latest.current.displayName;
				},
				titleOf: (save) => puzzleTitle(latest.current.copy, save),
				isCurrent: () => active && latest.current.userId === userId,
			},
			cloud: {
				create: (args) => convex.mutation(api.sudoku.create, args),
				saveProgress: (args) => convex.mutation(api.sudoku.saveProgress, args),
				setPaused: (args) => convex.mutation(api.sudoku.setPaused, args),
				complete: (args) => convex.mutation(api.sudoku.complete, args),
				listSessions: async () =>
					sudokuSessionsOf(
						await convex.query(api.sessions.listParticipation, {}),
					),
				// No guest id: sync reads only the account's own puzzles.
				getBundle: (sessionId) =>
					convex.query(api.sudoku.getBundle, { sessionId }),
			},
		};
		const sync = () => {
			if (active) runner.request().catch(reportError);
		};
		let timer: ReturnType<typeof setTimeout> | undefined;
		sync();
		const stopWrites = onSudokuSaveWritten((change) => {
			if (change !== "game") return;
			clearTimeout(timer);
			timer = setTimeout(sync, SEND_DELAY_MS);
		});
		const foreground = AppState.addEventListener("change", (state) => {
			if (state === "active") sync();
		});
		return () => {
			active = false;
			current = null;
			clearTimeout(timer);
			stopWrites();
			foreground.remove();
		};
	}, [ready, userId, convex]);
}
