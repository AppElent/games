/** The pass-and-play match as React state, saved to the phone after every change. */
import {
	type LocalMatch,
	type LocalMatchAction,
	newLocalMatch,
	reduceLocalMatch,
} from "@arcadeclub/core/backgammon-local";
import { useCallback, useEffect, useState } from "react";
import { readLocalMatch, writeLocalMatch } from "./local-match-store";

export function useLocalMatch() {
	const [match, setMatch] = useState<LocalMatch>(
		() => readLocalMatch() ?? newLocalMatch(Date.now()),
	);

	useEffect(() => {
		writeLocalMatch(match);
	}, [match]);

	const dispatch = useCallback((action: LocalMatchAction) => {
		setMatch((current) => reduceLocalMatch(current, action, Date.now()));
	}, []);

	const restart = useCallback(() => {
		setMatch((current) => newLocalMatch(Date.now(), current.options));
	}, []);

	return { match, dispatch, restart };
}
