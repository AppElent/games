/** What the rule families share about a table: its piles, its log and its bots. */
import type { Rng } from "../random";
import { type CardId, drawCards } from "./deck";
import { type CardEvent, pushEvent } from "./events";

export type { BotMove } from "../table-engine";

type Table = {
	hands: CardId[][];
	stock: CardId[];
	discard: CardId[];
	events: CardEvent[];
	nextSeq: number;
};

/** Draws from the stock and logs a reshuffle if that needed one. */
export function drawWithReshuffle(state: Table, count: number, random: Rng) {
	const { drawn, reshuffled } = drawCards(state, count, random);
	if (reshuffled) {
		pushEvent(state, { type: "reshuffle" });
	}
	return drawn;
}

/** The part of a table every seat may see in every family. */
export function publicTable(state: Table) {
	return {
		/** Up to three cards under the top one, for a believable pile. */
		underTop: state.discard.slice(-4, -1),
		stockCount: state.stock.length,
		handCounts: state.hands.map((hand) => hand.length),
	};
}
