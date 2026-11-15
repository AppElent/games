/**
 * What every dice family shares: rolls drawn from the server's generator, a
 * cup of dice some of which are held, turn order that skips players who are
 * out, and the public event log clients animate from.
 *
 * Built for the families still to come: the cup holds any number of dice
 * (10.000 rolls six and sets scorers aside), `nextSeat` skips eliminated
 * players (Mexen's lives), and a family keeps per-player cups in its own state
 * and hides them in its view (Blufpoker).
 */
import { GameRuleError } from "../errors";
import type { Rng } from "../random";

export const DIE_FACES = [1, 2, 3, 4, 5, 6] as const;

/**
 * Rolls `count` dice. The server passes a fresh `Math.random` on every move, so
 * no stored state predicts the next roll and a client never chooses one; tests
 * pass a seeded generator.
 */
export function rollDice(random: Rng, count: number, faces = 6) {
	return Array.from({ length: count }, () => 1 + Math.floor(random() * faces));
}

/**
 * Checks which dice a player keeps: whole indices into the cup, each once.
 * Anything else comes from a broken or hostile client.
 */
export function requireKeep(keep: readonly number[], cupSize: number) {
	const seen = new Set<number>();
	for (const index of keep) {
		if (
			!Number.isInteger(index) ||
			index < 0 ||
			index >= cupSize ||
			seen.has(index)
		) {
			throw new GameRuleError("diceInvalidHold");
		}
		seen.add(index);
	}
}

/**
 * Rerolls every die not kept; kept dice stay in place, so a client's hold
 * marks still point at the same dice. Returns the new values and held marks.
 */
export function rollCup(
	random: Rng,
	values: readonly number[],
	keep: readonly number[],
	faces = 6,
) {
	requireKeep(keep, values.length);
	const fresh = rollDice(random, values.length - keep.length, faces);
	let next = 0;
	const held = values.map((_, index) => keep.includes(index));
	return {
		values: values.map((value, index) => (held[index] ? value : fresh[next++])),
		held,
	};
}

/** How many dice show each face: `counts[face]`, index 0 unused. */
export function faceCounts(values: readonly number[], faces = 6) {
	const counts = Array.from({ length: faces + 1 }, () => 0);
	for (const value of values) {
		counts[value] += 1;
	}
	return counts;
}

/** The next seat round the table that is still in the game. */
export function nextSeat(
	from: number,
	seats: number,
	out: readonly boolean[] = [],
) {
	for (let step = 1; step <= seats; step += 1) {
		const seat = (from + step) % seats;
		if (!out[seat]) {
			return seat;
		}
	}
	return from;
}

/**
 * What just happened at the table, in order. Public: a family with hidden dice
 * logs a roll without its values.
 */
export type DiceEvent = { seq: number } & (
	| { type: "roll"; seat: number; dice: number[]; held: boolean[] }
	| {
			type: "score";
			seat: number;
			category: string;
			points: number;
			bonus: number;
	  }
	| { type: "win"; seats: number[] }
);

type DiceEventInput = DiceEvent extends infer E
	? E extends DiceEvent
		? Omit<E, "seq">
		: never
	: never;

const EVENT_WINDOW = 24;

/** Appends to a bounded log; `seq` keeps counting so clients can diff. */
export function pushDiceEvent(
	state: { events: DiceEvent[]; nextSeq: number },
	event: DiceEventInput,
) {
	state.events.push({ ...event, seq: state.nextSeq } as DiceEvent);
	state.nextSeq += 1;
	if (state.events.length > EVENT_WINDOW) {
		state.events.splice(0, state.events.length - EVENT_WINDOW);
	}
}
