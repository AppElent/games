import type { CardId } from "@arcadeclub/core/cards/deck";
import type { CardEvent } from "@arcadeclub/core/cards/events";
import {
	nextFreshCards,
	startFreshCards,
} from "@arcadeclub/core/cards/table-view";
import { useEffect, useRef, useState } from "react";

const NO_CARDS: ReadonlySet<CardId> = new Set();

/** The cards that just arrived in this hand; see `nextFreshCards`. */
export function useFreshCards(
	hand: readonly CardId[],
	mine: boolean,
	events: readonly CardEvent[],
) {
	const memory = useRef(startFreshCards(mine));
	const [fresh, setFresh] = useState(NO_CARDS);

	useEffect(() => {
		memory.current = nextFreshCards(memory.current, hand, mine, events);
		const next = memory.current.fresh;
		setFresh((current) =>
			next.length === current.size && next.every((card) => current.has(card))
				? current
				: new Set(next),
		);
	}, [hand, mine, events]);

	return fresh;
}
