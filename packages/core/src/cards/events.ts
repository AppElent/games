import type { CardId, Suit } from "./deck";

/**
 * What just happened at the table, in order. Public: anything hidden (which
 * card someone drew) stays out. Clients animate and caption from this log.
 */
export type CardEvent = { seq: number } & (
	| { type: "deal"; round: number }
	| { type: "play"; seat: number; card: CardId; suit?: Suit }
	| { type: "draw"; seat: number; count: number; source: "stock" | "discard" }
	| { type: "penalty"; seat: number; count: number }
	| { type: "skip"; seat: number }
	| { type: "reverse"; direction: 1 | -1 }
	| { type: "again"; seat: number }
	| { type: "pass"; seat: number }
	| { type: "reshuffle" }
	| { type: "lastCard"; seat: number }
	| { type: "caught"; seat: number; by: number; count: number }
	| { type: "finishPenalty"; seat: number; count: number }
	| { type: "meld"; seat: number; meldIds: number[]; opened: boolean }
	| { type: "layoff"; seat: number; meldId: number; cards: CardId[] }
	| { type: "swap"; seat: number; meldId: number; card: CardId }
	| { type: "discard"; seat: number; card: CardId }
	| { type: "roundEnd"; winner: number | null; round: number }
	| { type: "win"; seats: number[] }
);

type CardEventInput = CardEvent extends infer E
	? E extends CardEvent
		? Omit<E, "seq">
		: never
	: never;

const EVENT_WINDOW = 24;

/** Appends to a bounded log; `seq` keeps counting so clients can diff. */
export function pushEvent(
	state: { events: CardEvent[]; nextSeq: number },
	event: CardEventInput,
) {
	state.events.push({ ...event, seq: state.nextSeq } as CardEvent);
	state.nextSeq += 1;
	if (state.events.length > EVENT_WINDOW) {
		state.events.splice(0, state.events.length - EVENT_WINDOW);
	}
}
