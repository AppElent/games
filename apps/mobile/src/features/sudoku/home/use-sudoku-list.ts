/** The Sudoku hub's list, kept current with the account and the phone. */
import { useAuth } from "@clerk/expo";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import type { Messages } from "../../../i18n";
import { useBackendAuthReady } from "../../sessions/use-backend-auth-ready";
import { sudokuSessionsOf } from "../saves/sudoku-cloud-sync";
import {
	hiddenSudokuSessions,
	listSudokuSaves,
	onSudokuSaveWritten,
	type SudokuSaveSummary,
} from "../saves/sudoku-save-store";
import { buildSudokuList } from "./sudoku-list";

export function useSudokuList(copy: Messages["games"]["sudoku"]) {
	const { isSignedIn, userId } = useAuth();
	const { ready } = useBackendAuthReady();
	const owner = isSignedIn && userId ? userId : null;
	const participation = useQuery(
		api.sessions.listParticipation,
		ready ? {} : "skip",
	);
	const [saves, setSaves] = useState<SudokuSaveSummary[]>([]);
	const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

	const refresh = useCallback(() => {
		setSaves(listSudokuSaves(owner));
		setHidden(hiddenSudokuSessions());
	}, [owner]);

	useFocusEffect(refresh);
	// The sync marks puzzles sent while the list is on screen.
	useEffect(() => onSudokuSaveWritten(refresh), [refresh]);

	const sessions =
		owner && participation ? sudokuSessionsOf(participation) : [];
	const rows = buildSudokuList({
		saves,
		sessions,
		hidden,
		signedIn: owner !== null,
		copy,
	});
	return { rows, signedIn: owner !== null, refresh };
}
