/**
 * The push-your-luck family (10.000, Farkle): roll a handful of dice, set
 * aside dice that score, then roll the rest again or bank the turn's points.
 * A roll with nothing that scores busts the turn and loses its points; setting
 * aside every die (hot dice) hands the player all of them again. The first to
 * reach the target ends the game, after everyone else has had one last turn.
 * Nothing is hidden: the view shows every score and the dice on the table.
 */
import { GameRuleError } from "../errors";
import type { Rng } from "../random";
import type { BotMove } from "../table-engine";
import {
	type DiceEvent,
	diceOutcomes,
	faceCounts,
	nextSeat,
	pushDiceEvent,
	requireKeep,
	rollDice,
} from "./table";

/** What four, five or six alike score. */
export type ManyOfAKind =
	/** Each die beyond three doubles the three's score: four 2s are 400, five 2s 800. */
	| { kind: "double" }
	/** Fixed points by count, whatever the face. */
	| { kind: "fixed"; points: { 4: number; 5: number; 6: number } };

export type PushluckRules = {
	dice: number;
	/** The banked score that ends the game. */
	target: number;
	/** Points one die showing this face scores on its own: 1 and 5. */
	singles: Partial<Record<number, number>>;
	/** Three alike score `face × perFace`, except three 1s, which score `ones`. */
	threeOfAKind: { perFace: number; ones: number };
	manyOfAKind: ManyOfAKind;
	/** Three different pairs in one roll of every die; null: no such combination. */
	threePairs: number | null;
	/** One of every face in one roll of every die; null: no such combination. */
	straight: number | null;
	/** Points a player must bank in one turn before getting on the board; 0: none. */
	openingScore: number;
	/** Whether everyone else gets one last turn once someone reaches the target. */
	finalRound: boolean;
};

export type PushluckState = {
	family: "pushluck";
	phase: "playing" | "finished";
	seats: number;
	starter: number;
	turn: number;
	/** Which pass round the table this is, from 1. */
	round: number;
	/** Banked points per seat. */
	scores: number[];
	/** The dice just rolled, waiting for some to be set aside; empty before the turn's first roll. */
	dice: number[];
	/** The dice set aside since the turn began or the last hot dice, for the table to show. */
	setAside: number[];
	/** Points set aside this turn, banked only if the turn ends with a bank. */
	turnTotal: number;
	/** The seat that reached the target first; everyone else then has one last turn. */
	finalRoundBy: number | null;
	winners: number[];
	events: DiceEvent[];
	nextSeq: number;
};

export type PushluckAction =
	/**
	 * Sets aside the dice at `keep` (indices into the roll; every one must
	 * score), then rolls the rest, or all of them again after hot dice. The
	 * turn's first roll keeps nothing.
	 */
	| { type: "roll"; keep: number[] }
	/** Sets aside the dice at `keep` and banks the turn's points. */
	| { type: "bank"; keep: number[] };

export const PUSHLUCK_ACTIONS = { roll: true, bank: true } as const;

export type PushluckView = {
	family: "pushluck";
	phase: PushluckState["phase"];
	turn: number;
	round: number;
	rules: PushluckRules;
	dice: number[];
	setAside: number[];
	turnTotal: number;
	scores: number[];
	finalRoundBy: number | null;
	winners: number[];
	events: DiceEvent[];
};

const KEY = (values: readonly number[]) => [...values].sort().join("");

/** What `count` dice alike showing `face` score, for three or more. */
export function kindScore(rules: PushluckRules, face: number, count: number) {
	const three =
		face === 1 ? rules.threeOfAKind.ones : face * rules.threeOfAKind.perFace;
	if (count === 3) {
		return three;
	}
	const many = rules.manyOfAKind;
	if (many.kind === "double") {
		return three * 2 ** (count - 3);
	}
	return many.points[count as 4 | 5 | 6] ?? three;
}

/**
 * What a set of dice scores when every one of them counts towards a scoring
 * combination, taking the best way to split them up; null when any die is
 * left over. These are the dice a player may set aside together.
 */
export function scoreSetAside(
	rules: PushluckRules,
	values: readonly number[],
): number | null {
	if (values.length === 0) {
		return null;
	}
	return bestSplit(rules, faceCounts(values), values.length, new Map());
}

function bestSplit(
	rules: PushluckRules,
	counts: number[],
	left: number,
	memo: Map<string, number | null>,
): number | null {
	if (left === 0) {
		return 0;
	}
	const key = counts.join("");
	const known = memo.get(key);
	if (known !== undefined) {
		return known;
	}
	let best: number | null = null;
	const consider = (points: number | null) => {
		if (points !== null && (best === null || points > best)) {
			best = points;
		}
	};
	const faces = counts.slice(1);
	if (left === 6) {
		if (rules.straight !== null && faces.every((count) => count === 1)) {
			consider(rules.straight);
		}
		if (
			rules.threePairs !== null &&
			faces.filter((count) => count === 2).length === 3
		) {
			consider(rules.threePairs);
		}
	}
	for (let face = 1; face < counts.length; face += 1) {
		for (let count = 3; count <= counts[face]; count += 1) {
			counts[face] -= count;
			const rest = bestSplit(rules, counts, left - count, memo);
			counts[face] += count;
			consider(rest === null ? null : kindScore(rules, face, count) + rest);
		}
		const single = rules.singles[face];
		if (single !== undefined && counts[face] > 0) {
			counts[face] -= 1;
			const rest = bestSplit(rules, counts, left - 1, memo);
			counts[face] += 1;
			consider(rest === null ? null : single + rest);
		}
	}
	memo.set(key, best);
	return best;
}

/**
 * Every way to set aside part of a roll that scores, one per distinct set of
 * faces, with its points and the indices it takes.
 */
export function setAsideChoices(
	rules: PushluckRules,
	dice: readonly number[],
): Array<{ keep: number[]; points: number }> {
	const seen = new Set<string>();
	const choices: Array<{ keep: number[]; points: number }> = [];
	for (let mask = 1; mask < 2 ** dice.length; mask += 1) {
		const keep = dice.flatMap((_, index) =>
			mask & (1 << index) ? [index] : [],
		);
		const kept = keep.map((index) => dice[index]);
		const key = KEY(kept);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		const points = scoreSetAside(rules, kept);
		if (points !== null) {
			choices.push({ keep, points });
		}
	}
	return choices;
}

/** Whether a roll has anything in it that scores; a roll without busts the turn. */
export function rollScores(rules: PushluckRules, dice: readonly number[]) {
	const counts = faceCounts(dice);
	return (
		counts.some(
			(count, face) =>
				face > 0 &&
				(count >= 3 || (count > 0 && rules.singles[face] !== undefined)),
		) ||
		(dice.length === 6 &&
			((rules.straight !== null && counts.slice(1).every((n) => n === 1)) ||
				(rules.threePairs !== null &&
					counts.slice(1).filter((n) => n === 2).length === 3)))
	);
}

/** Whether a seat may bank this many points in one turn. */
export function canBankTurn(
	rules: PushluckRules,
	banked: number,
	turnPoints: number,
) {
	return turnPoints > 0 && (banked > 0 || turnPoints >= rules.openingScore);
}

export function createPushluck(
	_rules: PushluckRules,
	seats: number,
	starter = 0,
): PushluckState {
	const first = starter % seats;
	return {
		family: "pushluck",
		phase: "playing",
		seats,
		starter: first,
		turn: first,
		round: 1,
		scores: Array.from({ length: seats }, () => 0),
		dice: [],
		setAside: [],
		turnTotal: 0,
		finalRoundBy: null,
		winners: [],
		events: [],
		nextSeq: 0,
	};
}

/** The next game starts with the seat after this one's starter. */
export function nextPushluckStarter(state: PushluckState) {
	return nextSeat(state.starter, state.seats);
}

function copy(state: PushluckState): PushluckState {
	return {
		...state,
		scores: [...state.scores],
		dice: [...state.dice],
		setAside: [...state.setAside],
		winners: [...state.winners],
		events: [...state.events],
	};
}

/** Takes the dice at `keep` off the table and adds their points to the turn. */
function setAside(rules: PushluckRules, state: PushluckState, keep: number[]) {
	if (state.dice.length === 0) {
		throw new GameRuleError("diceRollFirst");
	}
	if (keep.length === 0) {
		throw new GameRuleError("diceSetAsideFirst");
	}
	requireKeep(keep, state.dice.length);
	const kept = keep.map((index) => state.dice[index]);
	const points = scoreSetAside(rules, kept);
	if (points === null) {
		throw new GameRuleError("diceNotScoring");
	}
	state.turnTotal += points;
	state.setAside.push(...kept);
	state.dice = state.dice.filter((_, index) => !keep.includes(index));
}

function finish(state: PushluckState) {
	const best = Math.max(...state.scores);
	state.phase = "finished";
	state.winners = state.scores.flatMap((score, seat) =>
		score === best ? [seat] : [],
	);
	state.dice = [];
	state.setAside = [];
	state.turnTotal = 0;
	pushDiceEvent(state, { type: "win", seats: state.winners });
}

/** Hands the dice to the next seat, or ends the game when the final round is over. */
function endTurn(state: PushluckState) {
	state.dice = [];
	state.setAside = [];
	state.turnTotal = 0;
	const next = nextSeat(state.turn, state.seats);
	if (state.finalRoundBy !== null && next === state.finalRoundBy) {
		finish(state);
		return;
	}
	state.turn = next;
	if (next === state.starter) {
		state.round += 1;
	}
}

function roll(
	rules: PushluckRules,
	state: PushluckState,
	keep: number[],
	random: Rng,
) {
	const starting = state.dice.length === 0;
	if (starting) {
		if (keep.length > 0) {
			throw new GameRuleError("diceInvalidHold");
		}
	} else {
		setAside(rules, state, keep);
	}
	let count = starting ? rules.dice : state.dice.length;
	if (!starting && count === 0) {
		// Hot dice: every die scored, so the player rolls them all again.
		count = rules.dice;
		state.setAside = [];
		pushDiceEvent(state, {
			type: "hotDice",
			seat: state.turn,
			points: state.turnTotal,
		});
	}
	state.dice = rollDice(random, count);
	pushDiceEvent(state, {
		type: "roll",
		seat: state.turn,
		dice: [...state.dice],
		held: state.dice.map(() => false),
	});
	if (!rollScores(rules, state.dice)) {
		pushDiceEvent(state, {
			type: "bust",
			seat: state.turn,
			dice: [...state.dice],
			lost: state.turnTotal,
		});
		endTurn(state);
	}
}

function bank(rules: PushluckRules, state: PushluckState, keep: number[]) {
	setAside(rules, state, keep);
	const seat = state.turn;
	if (!canBankTurn(rules, state.scores[seat], state.turnTotal)) {
		throw new GameRuleError("diceBelowOpening", {
			needed: rules.openingScore,
			have: state.turnTotal,
		});
	}
	state.scores[seat] += state.turnTotal;
	pushDiceEvent(state, {
		type: "bank",
		seat,
		points: state.turnTotal,
		total: state.scores[seat],
	});
	if (state.scores[seat] >= rules.target && state.finalRoundBy === null) {
		if (!rules.finalRound) {
			finish(state);
			return;
		}
		state.finalRoundBy = seat;
		pushDiceEvent(state, { type: "finalRound", seat });
	}
	endTurn(state);
}

export function applyPushluck(
	rules: PushluckRules,
	state: PushluckState,
	seat: number,
	action: PushluckAction,
	random: Rng,
): PushluckState {
	if (state.phase !== "playing") {
		throw new GameRuleError("noActiveGame");
	}
	if (seat !== state.turn) {
		throw new GameRuleError("notYourTurn");
	}
	const next = copy(state);
	if (action.type === "roll") {
		roll(rules, next, action.keep, random);
	} else {
		bank(rules, next, action.keep);
	}
	return next;
}

/** Everything is public in this family. */
export function viewPushluck(
	rules: PushluckRules,
	state: PushluckState,
): PushluckView {
	return {
		family: "pushluck",
		phase: state.phase,
		turn: state.turn,
		round: state.round,
		rules,
		dice: state.dice,
		setAside: state.setAside,
		turnTotal: state.turnTotal,
		scores: state.scores,
		finalRoundBy: state.finalRoundBy,
		winners: state.winners,
		events: state.events,
	};
}

// The bot pushes its luck by the odds: for each way to set dice aside it
// weighs banking now against rolling what is left, using the exact chance
// that those dice bust and what they score on average when they do not.

type Odds = { bust: number; gain: number };

const oddsCache = new Map<string, Odds[]>();

/** For each number of dice: the chance a roll busts, and its best score on average. */
function oddsFor(rules: PushluckRules): Odds[] {
	const key = JSON.stringify([
		rules.dice,
		rules.singles,
		rules.threeOfAKind,
		rules.manyOfAKind,
		rules.threePairs,
		rules.straight,
	]);
	const cached = oddsCache.get(key);
	if (cached) {
		return cached;
	}
	const odds: Odds[] = [{ bust: 1, gain: 0 }];
	for (let count = 1; count <= rules.dice; count += 1) {
		let bust = 0;
		let gain = 0;
		for (const outcome of diceOutcomes(count)) {
			const best = Math.max(
				0,
				...setAsideChoices(rules, outcome.values).map(
					(choice) => choice.points,
				),
			);
			if (best === 0) {
				bust += outcome.p;
			}
			gain += outcome.p * best;
		}
		odds.push({ bust, gain });
	}
	oddsCache.set(key, odds);
	return odds;
}

/** What rolling `count` dice with `total` at stake is worth, one roll ahead. */
function rollValue(odds: Odds[], total: number, count: number) {
	const { bust, gain } = odds[count];
	// `gain` counts busts as 0, so it is already weighted by the chance of scoring.
	return (1 - bust) * total + gain;
}

export function botPushluckMove(
	rules: PushluckRules,
	state: PushluckState,
	bots: readonly number[],
): BotMove<PushluckAction> | null {
	if (state.phase !== "playing" || !bots.includes(state.turn)) {
		return null;
	}
	const seat = state.turn;
	if (state.dice.length === 0) {
		return { seat, action: { type: "roll", keep: [] }, pace: "turn" };
	}
	const odds = oddsFor(rules);
	const banked = state.scores[seat];
	const rivals = state.scores.filter((_, other) => other !== seat);
	const leader = Math.max(0, ...rivals);
	let best: { action: PushluckAction; value: number } | null = null;
	for (const choice of setAsideChoices(rules, state.dice)) {
		const total = state.turnTotal + choice.points;
		const left = state.dice.length - choice.keep.length || rules.dice;
		const after = banked + total;
		const finalRound = state.finalRoundBy !== null;
		// In the final round only passing the leader counts.
		const mayBank =
			canBankTurn(rules, banked, total) && (!finalRound || after > leader);
		// Passing the leader in the final round, or reaching the target without one, is worth any risk.
		const wins =
			mayBank && (finalRound || (!rules.finalRound && after >= rules.target));
		const options: Array<{ action: PushluckAction; value: number }> = [
			{
				action: { type: "roll", keep: choice.keep },
				value: rollValue(odds, total, left),
			},
		];
		if (mayBank) {
			options.push({
				action: { type: "bank", keep: choice.keep },
				value: wins ? Number.POSITIVE_INFINITY : total,
			});
		}
		for (const option of options) {
			if (!best || option.value > best.value) {
				best = option;
			}
		}
	}
	// A roll always scores something, or the turn would already have busted.
	if (!best) {
		return null;
	}
	return { seat, action: best.action, pace: "followUp" };
}
