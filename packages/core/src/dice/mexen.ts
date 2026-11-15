/**
 * The Mexen family: two dice read high die first (6-3 is 63), and each round
 * the lowest throw loses. The round's first player throws up to `maxThrows`
 * times; how many throws they used is the most anyone else may take that
 * round, and everyone keeps their last throw. 2-1 (Mex) beats everything,
 * then doubles from 6-6 down, then plain numbers from 65 down to 31. Ties for
 * lowest throw off with one throw each until one player is lowest. Nothing is
 * hidden: the view shows every throw.
 */
import { GameRuleError } from "../errors";
import type { Rng } from "../random";
import type { BotMove } from "../table-engine";
import { type DiceEvent, nextSeat, pushDiceEvent, rollDice } from "./table";

export type MexenRules = {
	/** Throws the round's first player may take; their count caps everyone else. */
	maxThrows: number;
	/** Lives each player starts with, or the point total that ends a points game. */
	lives: number;
	/** A round with a Mex in it costs its loser two instead of one. */
	mexDoubles: boolean;
	/** 3-1 is Little Mex: second only to Mex, above every double (as in Meyer). */
	littleMex: boolean;
	/**
	 * `lives`: losers lose lives and drop out at none; the last one standing wins.
	 * `points`: nobody drops out; losers collect points until someone reaches
	 * `lives` of them, and the fewest points win.
	 */
	scoring: "lives" | "points";
};

export const MEXEN_THROW_KINDS = [
	"mex",
	"littleMex",
	"double",
	"plain",
] as const;
export type MexenThrowKind = (typeof MEXEN_THROW_KINDS)[number];

/** Two dice read as one throw: high die as tens, and where that ranks. */
export type MexenThrow = {
	kind: MexenThrowKind;
	/** High die as tens: 6-3 is 63, Mex is 21. */
	value: number;
	/** Higher beats lower; equal ranks tie. */
	rank: number;
};

export type MexenState = {
	family: "mexen";
	phase: "playing" | "finished";
	seats: number;
	/** Who threw first in the game, so a rematch hands that on. */
	starter: number;
	round: number;
	/** The round's first thrower, whose throw count caps everyone else. */
	leader: number;
	/** Who throws this round (or this throw-off), in order. */
	order: number[];
	turn: number;
	/** The throw cap the leader set; null until they stand. */
	limit: number | null;
	/** True while tied players throw off for lowest. */
	throwOff: boolean;
	rollsUsed: number;
	/** The current player's dice; empty before their first throw. */
	dice: number[];
	/** Each seat's kept throw this round; null before they stand. */
	results: Array<number[] | null>;
	/** A Mex was kept this round, so its loss counts double. */
	doubled: boolean;
	/** Lives lost, or points collected, per seat. */
	penalties: number[];
	/** Seats that ran out of lives, in the order they went out. */
	eliminated: number[];
	winners: number[];
	events: DiceEvent[];
	nextSeq: number;
};

export type MexenAction =
	/** Throws both dice; Mexen never keeps one, so `keep` must be empty. */
	{ type: "roll"; keep: number[] } | { type: "stand" };

export const MEXEN_ACTIONS = { roll: true, stand: true } as const;

export type MexenView = {
	family: "mexen";
	phase: MexenState["phase"];
	round: number;
	turn: number;
	leader: number;
	order: number[];
	throwOff: boolean;
	rollsUsed: number;
	/** The most throws the player on turn may take. */
	throwCap: number;
	/** Whether the leader has set this round's cap yet. */
	limitSet: boolean;
	maxThrows: number;
	dice: number[];
	/** The dice on the table, read. Null before the first throw. */
	current: MexenThrow | null;
	results: Array<(MexenThrow & { dice: number[] }) | null>;
	scoring: MexenRules["scoring"];
	/** Starting lives, or the points that end the game. */
	lives: number;
	mexDoubles: boolean;
	littleMex: boolean;
	doubled: boolean;
	penalties: number[];
	/** Lives left per seat (lives scoring); never below zero. */
	livesLeft: number[];
	out: boolean[];
	/** Seats that ran out of lives, in the order they went out. */
	eliminated: number[];
	/**
	 * The latest kept throw until the next roll, so a throw kept as it lands
	 * (the last one allowed, often the one that ends the round) still shows
	 * its dice once they leave the table.
	 */
	lastKept: (MexenThrow & { seat: number; dice: number[] }) | null;
	winners: number[];
	events: DiceEvent[];
};

const MEX_RANK = 1000;
const LITTLE_MEX_RANK = 900;
const DOUBLE_RANK = 100;

/** Two dice read high die first: 6 and 3 make 63. */
export function throwValue(dice: readonly number[]) {
	return Math.max(dice[0], dice[1]) * 10 + Math.min(dice[0], dice[1]);
}

/** Reads two dice as a Mexen throw. */
export function readThrow(
	dice: readonly number[],
	rules: Pick<MexenRules, "littleMex">,
): MexenThrow {
	const value = throwValue(dice);
	if (value === 21) {
		return { kind: "mex", value, rank: MEX_RANK };
	}
	if (rules.littleMex && value === 31) {
		return { kind: "littleMex", value, rank: LITTLE_MEX_RANK };
	}
	if (dice[0] === dice[1]) {
		return { kind: "double", value, rank: DOUBLE_RANK + dice[0] };
	}
	return { kind: "plain", value, rank: value };
}

/** Every one of the 36 equally likely throws, read under these rules. */
function allThrows(rules: Pick<MexenRules, "littleMex">) {
	const throws: MexenThrow[] = [];
	for (let a = 1; a <= 6; a += 1) {
		for (let b = 1; b <= 6; b += 1) {
			throws.push(readThrow([a, b], rules));
		}
	}
	return throws;
}

/** The chance a fresh throw beats `rank` outright. */
export function chanceToBeat(
	rules: Pick<MexenRules, "littleMex">,
	rank: number,
) {
	const throws = allThrows(rules);
	return throws.filter((option) => option.rank > rank).length / throws.length;
}

function isOut(rules: MexenRules, state: MexenState, seat: number) {
	return rules.scoring === "lives" && state.penalties[seat] >= rules.lives;
}

function outFlags(rules: MexenRules, state: MexenState) {
	return state.penalties.map((_, seat) => isOut(rules, state, seat));
}

/** Seats still in the game, in table order starting from `from`. */
function roundOrder(rules: MexenRules, state: MexenState, from: number) {
	const order: number[] = [];
	for (let step = 0; step < state.seats; step += 1) {
		const seat = (from + step) % state.seats;
		if (!isOut(rules, state, seat)) {
			order.push(seat);
		}
	}
	return order;
}

function throwCap(rules: MexenRules, state: MexenState) {
	// A throw-off is one throw each; the leader's `limit` waits for the next round.
	if (state.throwOff) {
		return 1;
	}
	return state.turn === state.leader || state.limit === null
		? rules.maxThrows
		: state.limit;
}

export function createMexen(
	_rules: MexenRules,
	seats: number,
	starter = 0,
): MexenState {
	const first = starter % seats;
	return {
		family: "mexen",
		phase: "playing",
		seats,
		starter: first,
		round: 1,
		leader: first,
		order: Array.from({ length: seats }, (_, step) => (first + step) % seats),
		turn: first,
		limit: null,
		throwOff: false,
		rollsUsed: 0,
		dice: [],
		results: Array.from({ length: seats }, () => null),
		doubled: false,
		penalties: Array.from({ length: seats }, () => 0),
		eliminated: [],
		winners: [],
		events: [],
		nextSeq: 0,
	};
}

/** The next game starts with the seat after this one's starter. */
export function nextMexenStarter(state: MexenState) {
	return nextSeat(state.starter, state.seats);
}

function copy(state: MexenState): MexenState {
	return {
		...state,
		order: [...state.order],
		dice: [...state.dice],
		results: state.results.map((result) => (result ? [...result] : null)),
		penalties: [...state.penalties],
		eliminated: [...state.eliminated],
		winners: [...state.winners],
		events: [...state.events],
	};
}

function finish(state: MexenState, winners: number[]) {
	state.phase = "finished";
	state.winners = winners;
	state.turn = winners[0] ?? state.turn;
	state.dice = [];
	state.rollsUsed = 0;
	pushDiceEvent(state, { type: "win", seats: winners });
}

/** Starts a fresh round led by `leader`. */
function startRound(rules: MexenRules, state: MexenState, leader: number) {
	state.round += 1;
	state.leader = leader;
	state.order = roundOrder(rules, state, leader);
	state.turn = leader;
	state.limit = null;
	state.throwOff = false;
	state.doubled = false;
	state.results = state.results.map(() => null);
	state.rollsUsed = 0;
	state.dice = [];
}

/** Everyone in the round has stood: find the lowest throw, or start a throw-off. */
function resolveRound(rules: MexenRules, state: MexenState) {
	const ranks = state.order.map((seat) => {
		const result = state.results[seat];
		return result ? readThrow(result, rules).rank : Number.POSITIVE_INFINITY;
	});
	const lowest = Math.min(...ranks);
	const tied = state.order.filter((_, index) => ranks[index] === lowest);
	if (tied.length > 1) {
		pushDiceEvent(state, { type: "mexenThrowOff", seats: tied });
		state.throwOff = true;
		state.order = tied;
		state.turn = tied[0];
		for (const seat of tied) {
			state.results[seat] = null;
		}
		state.rollsUsed = 0;
		state.dice = [];
		return;
	}
	const [loser] = tied;
	const amount = rules.mexDoubles && state.doubled ? 2 : 1;
	state.penalties[loser] += amount;
	const out = isOut(rules, state, loser);
	if (out) {
		state.eliminated.push(loser);
	}
	pushDiceEvent(state, {
		type: "mexenLose",
		seat: loser,
		amount,
		unit: rules.scoring,
		out,
	});

	if (rules.scoring === "lives") {
		const alive = state.penalties.flatMap((_, seat) =>
			isOut(rules, state, seat) ? [] : [seat],
		);
		if (alive.length <= 1) {
			finish(state, alive);
			return;
		}
	} else if (state.penalties[loser] >= rules.lives) {
		const fewest = Math.min(...state.penalties);
		finish(
			state,
			state.penalties.flatMap((points, seat) =>
				points === fewest ? [seat] : [],
			),
		);
		return;
	}
	// The loser leads the next round, or the next player still in if they dropped out.
	startRound(
		rules,
		state,
		out ? nextSeat(loser, state.seats, outFlags(rules, state)) : loser,
	);
}

/** The player on turn keeps their dice; the round moves on. */
function stand(rules: MexenRules, state: MexenState) {
	const seat = state.turn;
	const kept = readThrow(state.dice, rules);
	state.results[seat] = [...state.dice];
	if (kept.kind === "mex") {
		state.doubled = true;
	}
	pushDiceEvent(state, {
		type: "mexenStand",
		seat,
		dice: [...state.dice],
		kind: kept.kind,
	});
	if (!state.throwOff && seat === state.leader) {
		state.limit = state.rollsUsed;
	}
	const next = state.order.find((candidate) => !state.results[candidate]);
	state.rollsUsed = 0;
	state.dice = [];
	if (next === undefined) {
		resolveRound(rules, state);
		return;
	}
	state.turn = next;
}

function roll(
	rules: MexenRules,
	state: MexenState,
	keep: readonly number[],
	random: Rng,
) {
	if (keep.length > 0) {
		throw new GameRuleError("diceInvalidHold");
	}
	if (state.rollsUsed >= throwCap(rules, state)) {
		throw new GameRuleError("diceNoRollsLeft");
	}
	state.dice = rollDice(random, 2);
	state.rollsUsed += 1;
	pushDiceEvent(state, {
		type: "roll",
		seat: state.turn,
		dice: [...state.dice],
		held: [false, false],
	});
	// The last throw allowed is kept without asking.
	if (state.rollsUsed >= throwCap(rules, state)) {
		stand(rules, state);
	}
}

export function applyMexen(
	rules: MexenRules,
	state: MexenState,
	seat: number,
	action: MexenAction,
	random: Rng,
): MexenState {
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
		if (next.rollsUsed === 0) {
			throw new GameRuleError("diceRollFirst");
		}
		stand(rules, next);
	}
	return next;
}

/** Everything is public in this family. */
export function viewMexen(rules: MexenRules, state: MexenState): MexenView {
	return {
		family: "mexen",
		phase: state.phase,
		round: state.round,
		turn: state.turn,
		leader: state.leader,
		order: state.order,
		throwOff: state.throwOff,
		rollsUsed: state.rollsUsed,
		throwCap: throwCap(rules, state),
		limitSet: state.limit !== null,
		maxThrows: rules.maxThrows,
		dice: state.dice,
		current: state.dice.length === 2 ? readThrow(state.dice, rules) : null,
		results: state.results.map((dice) =>
			dice ? { ...readThrow(dice, rules), dice } : null,
		),
		scoring: rules.scoring,
		lives: rules.lives,
		mexDoubles: rules.mexDoubles,
		littleMex: rules.littleMex,
		doubled: state.doubled,
		penalties: state.penalties,
		livesLeft: state.penalties.map((lost) => Math.max(0, rules.lives - lost)),
		out: outFlags(rules, state),
		eliminated: state.eliminated,
		lastKept: lastKept(rules, state),
		winners: state.winners,
		events: state.events,
	};
}

/** The latest kept throw until someone throws again, even across a round's end. */
function lastKept(rules: MexenRules, state: MexenState) {
	for (let index = state.events.length - 1; index >= 0; index -= 1) {
		const event = state.events[index];
		if (event.type === "roll") {
			return null;
		}
		if (event.type === "mexenStand") {
			return {
				...readThrow(event.dice, rules),
				seat: event.seat,
				dice: event.dice,
			};
		}
	}
	return null;
}

// The bot: the round's first player stands on a throw a fresh one is unlikely
// to beat, keeping everyone else's cap low; anyone after them stands as soon
// as they are above the lowest throw kept so far, because then they can no
// longer lose the round.

/** How likely a fresh throw may be to beat the leader's before they stand, by throws used. */
const LEADER_STAND_BELOW = [0, 0.35, 0.5];

export function botMexenMove(
	rules: MexenRules,
	state: MexenState,
	bots: readonly number[],
): BotMove<MexenAction> | null {
	if (state.phase !== "playing" || !bots.includes(state.turn)) {
		return null;
	}
	const seat = state.turn;
	if (state.rollsUsed === 0) {
		return { seat, action: { type: "roll", keep: [] }, pace: "turn" };
	}
	const current = readThrow(state.dice, rules).rank;
	let keep: boolean;
	if (seat === state.leader && !state.throwOff) {
		const threshold =
			LEADER_STAND_BELOW[state.rollsUsed] ??
			LEADER_STAND_BELOW[LEADER_STAND_BELOW.length - 1];
		keep = chanceToBeat(rules, current) <= threshold;
	} else {
		const kept = state.order.flatMap((other) => {
			const result = state.results[other];
			return other !== seat && result ? [readThrow(result, rules).rank] : [];
		});
		keep = kept.length > 0 && current > Math.min(...kept);
	}
	return {
		seat,
		action: keep ? { type: "stand" } : { type: "roll", keep: [] },
		pace: "followUp",
	};
}
