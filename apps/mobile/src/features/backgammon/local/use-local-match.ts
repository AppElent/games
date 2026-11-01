/**
 * The pass-and-play match as React state, saved to the phone after every
 * change. Dice are rolled here, outside the pure transitions.
 */
import { rollBackgammonDice } from "@arcadeclub/core/backgammon";
import { useCallback, useEffect, useState } from "react";
import {
	type LocalMatch,
	type LocalMatchAction,
	newLocalMatch,
	reduceLocalMatch,
} from "./local-match";
import { readLocalMatch, writeLocalMatch } from "./local-match-store";

export function useLocalMatch() {
	const [match, setMatch] = useState<LocalMatch>(
		() => readLocalMatch() ?? newLocalMatch(),
	);

	useEffect(() => {
		writeLocalMatch(match);
	}, [match]);

	const dispatch = useCallback((action: LocalMatchAction) => {
		const dice = rollBackgammonDice();
		setMatch((current) => reduceLocalMatch(current, action, dice));
	}, []);

	const restart = useCallback(() => {
		setMatch((current) => newLocalMatch(current.options));
	}, []);

	return { match, dispatch, restart };
}
