/**
 * The score-sheet family: roll a cup of dice up to a few times a turn, hold
 * what you like, then fill one open box on your sheet. Every box is data (a
 * `CategoryRule`), so Yatzy, Yahtzee and their cousins differ only in config.
 * Nothing is hidden: the view shows every sheet and the dice on the table.
 */
import { GameRuleError } from "../errors";
import type { Rng } from "../random";
import type { BotMove } from "../table-engine";
import {
	type DiceEvent,
	faceCounts,
	nextSeat,
	pushDiceEvent,
	rollCup,
} from "./table";

/** Every box any score-sheet game may have. A game's `sheet` picks and orders them. */
export const SCORE_CATEGORIES = [
	"ones",
	"twos",
	"threes",
	"fours",
	"fives",
	"sixes",
	"onePair",
	"twoPairs",
	"threeKind",
	"fourKind",
	"smallStraight",
	"largeStraight",
	"fullHouse",
	"chance",
	"yatzy",
] as const;
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];

/** Fixed points, or the sum of the dice that count. */
type Points = number | "sum";

/** How one box scores the dice. */
export type CategoryRule =
	/** The total of the dice showing `face`. */
	| { kind: "face"; face: number }
	/** The highest pair, or two different pairs: the sum of those dice. */
	| { kind: "pairs"; pairs: 1 | 2 }
	/** `count` dice alike: the sum of those (`matching`) or of every die (`all`). */
	| { kind: "kind"; count: number; score: "matching" | "all" }
	/** `length` faces in a row, starting at `from` when set, anywhere when not. */
	| { kind: "straight"; length: number; from?: number; points: Points }
	/** Three of one face and two of another. */
	| { kind: "fullHouse"; points: Points }
	/** Anything: the sum of every die. */
	| { kind: "chance" }
	/** Every die alike. */
	| { kind: "allSame"; points: number };

export type SheetEntry = {
	id: ScoreCategory;
	section: "upper" | "lower";
	rule: CategoryRule;
};

export type ScoresheetRules = {
	dice: number;
	rollsPerTurn: number;
	sheet: readonly SheetEntry[];
	/** Upper-section boxes adding up to `threshold` or more earn `points`. */
	upperBonus: { threshold: number; points: number };
	/**
	 * Another all-same roll once that box is filled: `bonus` points if the box
	 * scored, and the joker rules decide where it may go. Null: it scores like
	 * any other roll.
	 */
	extraAllSame: { bonus: number } | null;
};

export type Scores = Partial<Record<ScoreCategory, number>>;

export type ScoresheetState = {
	family: "scoresheet";
	phase: "playing" | "finished";
	seats: number;
	starter: number;
	turn: number;
	/** Which pass round the table this is, from 1 to the sheet's length. */
	round: number;
	/** The dice on the table; empty before the turn's first roll. */
	dice: number[];
	held: boolean[];
	rollsUsed: number;
	sheets: Scores[];
	/** Points from extra all-same rolls, per seat. */
	extras: number[];
	winners: number[];
	events: DiceEvent[];
	nextSeq: number;
};

export type ScoresheetAction =
	/** Rerolls every die whose index is not in `keep`; the first roll keeps nothing. */
	{ type: "roll"; keep: number[] } | { type: "score"; category: ScoreCategory };

export const SCORESHEET_ACTIONS = { roll: true, score: true } as const;

export type ScoreOption = { category: ScoreCategory; points: number };

export type SheetTotals = {
	upper: number;
	upperBonus: number;
	lower: number;
	extra: number;
	total: number;
};

export type ScoresheetView = {
	family: "scoresheet";
	phase: ScoresheetState["phase"];
	turn: number;
	round: number;
	rounds: number;
	dice: number[];
	held: boolean[];
	diceCount: number;
	rollsUsed: number;
	rollsPerTurn: number;
	sheet: readonly SheetEntry[];
	upperBonus: ScoresheetRules["upperBonus"];
	sheets: Array<{ scores: Scores } & SheetTotals>;
	/** Where the dice on the table may go, and for how much. Empty before a roll. */
	options: ScoreOption[];
	winners: number[];
	events: DiceEvent[];
};

const sum = (values: readonly number[]) =>
	values.reduce((total, value) => total + value, 0);

function runSum(from: number, length: number) {
	return sum(Array.from({ length }, (_, index) => from + index));
}

function hasRun(counts: readonly number[], from: number, length: number) {
	for (let face = from; face < from + length; face += 1) {
		if (!counts[face]) {
			return false;
		}
	}
	return true;
}

/** The faces of a cup, from high to low, that show at least `count` times. */
function facesWith(counts: readonly number[], count: number) {
	const faces: number[] = [];
	for (let face = counts.length - 1; face >= 1; face -= 1) {
		if (counts[face] >= count) {
			faces.push(face);
		}
	}
	return faces;
}

/** What a box would score for these dice, before any joker rule. */
export function scoreCategory(rule: CategoryRule, values: readonly number[]) {
	const counts = faceCounts(values);
	const total = sum(values);
	switch (rule.kind) {
		case "face":
			return counts[rule.face] * rule.face;
		case "pairs": {
			const pairs = facesWith(counts, 2).slice(0, rule.pairs);
			return pairs.length === rule.pairs ? sum(pairs) * 2 : 0;
		}
		case "kind": {
			const [face] = facesWith(counts, rule.count);
			if (face === undefined) {
				return 0;
			}
			return rule.score === "all" ? total : face * rule.count;
		}
		case "straight": {
			const starts =
				rule.from === undefined
					? Array.from(
							{ length: counts.length - rule.length },
							(_, index) => index + 1,
						)
					: [rule.from];
			const start = starts.find((from) => hasRun(counts, from, rule.length));
			if (start === undefined) {
				return 0;
			}
			return rule.points === "sum" ? runSum(start, rule.length) : rule.points;
		}
		case "fullHouse": {
			const [three] = facesWith(counts, 3);
			const two = facesWith(counts, 2).find((face) => face !== three);
			if (three === undefined || two === undefined) {
				return 0;
			}
			return rule.points === "sum" ? total : rule.points;
		}
		case "chance":
			return total;
		case "allSame":
			return counts.includes(values.length) ? rule.points : 0;
	}
}

/** A box filled as a joker: a full house or straight counts as made. */
function jokerScore(rule: CategoryRule, values: readonly number[]) {
	switch (rule.kind) {
		case "fullHouse":
			return rule.points === "sum" ? sum(values) : rule.points;
		case "straight":
			return rule.points === "sum"
				? runSum(rule.from ?? 1, rule.length)
				: rule.points;
		default:
			return scoreCategory(rule, values);
	}
}

function allSameBox(rules: ScoresheetRules) {
	return rules.sheet.find((entry) => entry.rule.kind === "allSame");
}

/** Whether this roll is an extra all-same roll that the joker rules govern. */
function isJoker(
	rules: ScoresheetRules,
	scores: Scores,
	values: readonly number[],
) {
	const box = allSameBox(rules);
	return (
		rules.extraAllSame !== null &&
		box !== undefined &&
		scores[box.id] !== undefined &&
		values.length > 0 &&
		values.every((value) => value === values[0])
	);
}

/**
 * Every box these dice may go in, with its points. Under the joker rules an
 * extra all-same roll must take its own upper box if open, else any open lower
 * box (scored as made), else any open upper box.
 */
export function scoreOptions(
	rules: ScoresheetRules,
	scores: Scores,
	values: readonly number[],
): ScoreOption[] {
	const open = rules.sheet.filter((entry) => scores[entry.id] === undefined);
	const plain = (entries: readonly SheetEntry[]) =>
		entries.map((entry) => ({
			category: entry.id,
			points: scoreCategory(entry.rule, values),
		}));
	if (!isJoker(rules, scores, values)) {
		return plain(open);
	}
	const own = open.find(
		(entry) => entry.rule.kind === "face" && entry.rule.face === values[0],
	);
	if (own) {
		return plain([own]);
	}
	const lower = open.filter((entry) => entry.section === "lower");
	if (lower.length > 0) {
		return lower.map((entry) => ({
			category: entry.id,
			points: jokerScore(entry.rule, values),
		}));
	}
	return plain(open);
}

export function sheetTotals(
	rules: ScoresheetRules,
	scores: Scores,
	extra: number,
): SheetTotals {
	let upper = 0;
	let lower = 0;
	for (const entry of rules.sheet) {
		const points = scores[entry.id] ?? 0;
		if (entry.section === "upper") {
			upper += points;
		} else {
			lower += points;
		}
	}
	const upperBonus =
		upper >= rules.upperBonus.threshold ? rules.upperBonus.points : 0;
	return {
		upper,
		upperBonus,
		lower,
		extra,
		total: upper + upperBonus + lower + extra,
	};
}

function isComplete(rules: ScoresheetRules, scores: Scores) {
	return rules.sheet.every((entry) => scores[entry.id] !== undefined);
}

export function createScoresheet(
	_rules: ScoresheetRules,
	seats: number,
	starter = 0,
): ScoresheetState {
	const first = starter % seats;
	return {
		family: "scoresheet",
		phase: "playing",
		seats,
		starter: first,
		turn: first,
		round: 1,
		dice: [],
		held: [],
		rollsUsed: 0,
		sheets: Array.from({ length: seats }, () => ({})),
		extras: Array.from({ length: seats }, () => 0),
		winners: [],
		events: [],
		nextSeq: 0,
	};
}

/** The next game starts with the seat after this one's starter. */
export function nextScoresheetStarter(state: ScoresheetState) {
	return nextSeat(state.starter, state.seats);
}

function copy(state: ScoresheetState): ScoresheetState {
	return {
		...state,
		dice: [...state.dice],
		held: [...state.held],
		sheets: state.sheets.map((scores) => ({ ...scores })),
		extras: [...state.extras],
		winners: [...state.winners],
		events: [...state.events],
	};
}

function finish(rules: ScoresheetRules, state: ScoresheetState) {
	const totals = state.sheets.map(
		(scores, seat) => sheetTotals(rules, scores, state.extras[seat]).total,
	);
	const best = Math.max(...totals);
	state.phase = "finished";
	state.winners = totals.flatMap((total, seat) =>
		total === best ? [seat] : [],
	);
	pushDiceEvent(state, { type: "win", seats: state.winners });
}

function roll(
	rules: ScoresheetRules,
	state: ScoresheetState,
	keep: number[],
	random: Rng,
) {
	if (state.rollsUsed >= rules.rollsPerTurn) {
		throw new GameRuleError("diceNoRollsLeft");
	}
	// Nothing to keep before the first roll, and keeping every die would spend a roll on nothing.
	if (
		(state.rollsUsed === 0 && keep.length > 0) ||
		(state.rollsUsed > 0 && keep.length >= state.dice.length)
	) {
		throw new GameRuleError("diceInvalidHold");
	}
	const values =
		state.rollsUsed === 0
			? Array.from({ length: rules.dice }, () => 0)
			: state.dice;
	const rolled = rollCup(random, values, keep);
	state.dice = rolled.values;
	state.held = rolled.held;
	state.rollsUsed += 1;
	pushDiceEvent(state, {
		type: "roll",
		seat: state.turn,
		dice: [...state.dice],
		held: [...state.held],
	});
}

function score(
	rules: ScoresheetRules,
	state: ScoresheetState,
	category: ScoreCategory,
) {
	if (state.rollsUsed === 0) {
		throw new GameRuleError("diceRollFirst");
	}
	if (!rules.sheet.some((entry) => entry.id === category)) {
		throw new GameRuleError("diceUnknownCategory");
	}
	const scores = state.sheets[state.turn];
	if (scores[category] !== undefined) {
		throw new GameRuleError("diceCategoryTaken");
	}
	const option = scoreOptions(rules, scores, state.dice).find(
		(candidate) => candidate.category === category,
	);
	if (!option) {
		throw new GameRuleError("diceJokerRule");
	}
	const box = allSameBox(rules);
	const bonus =
		rules.extraAllSame &&
		box &&
		isJoker(rules, scores, state.dice) &&
		(scores[box.id] ?? 0) > 0
			? rules.extraAllSame.bonus
			: 0;
	scores[category] = option.points;
	state.extras[state.turn] += bonus;
	pushDiceEvent(state, {
		type: "score",
		seat: state.turn,
		category,
		points: option.points,
		bonus,
	});
	if (state.sheets.every((sheet) => isComplete(rules, sheet))) {
		finish(rules, state);
		return;
	}
	state.turn = nextSeat(state.turn, state.seats);
	if (state.turn === state.starter) {
		state.round += 1;
	}
	state.dice = [];
	state.held = [];
	state.rollsUsed = 0;
}

export function applyScoresheet(
	rules: ScoresheetRules,
	state: ScoresheetState,
	seat: number,
	action: ScoresheetAction,
	random: Rng,
): ScoresheetState {
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
		score(rules, next, action.category);
	}
	return next;
}

/** Everything is public in this family. */
export function viewScoresheet(
	rules: ScoresheetRules,
	state: ScoresheetState,
): ScoresheetView {
	return {
		family: "scoresheet",
		phase: state.phase,
		turn: state.turn,
		round: state.round,
		rounds: rules.sheet.length,
		dice: state.dice,
		held: state.held,
		diceCount: rules.dice,
		rollsUsed: state.rollsUsed,
		rollsPerTurn: rules.rollsPerTurn,
		sheet: rules.sheet,
		upperBonus: rules.upperBonus,
		sheets: state.sheets.map((scores, seat) => ({
			scores,
			...sheetTotals(rules, scores, state.extras[seat]),
		})),
		options:
			state.phase === "playing" && state.rollsUsed > 0
				? scoreOptions(rules, state.sheets[state.turn], state.dice)
				: [],
		winners: state.winners,
		events: state.events,
	};
}

// The bot: it values a box by its points against what that box usually
// brings, and before a reroll it weighs every way of holding by the chance of
// each result of the dice it throws again.

/** Roughly how likely a player chasing a box makes it within a turn. */
const MAKE_CHANCE = { pairs1: 0.75, pairs2: 0.5, kind3: 0.6, kind4: 0.35 };

/** What a box usually brings, so a bot knows a low score here is a loss. */
function par(rules: ScoresheetRules, rule: CategoryRule) {
	const high = 4.5;
	switch (rule.kind) {
		case "face":
			return 3 * rule.face;
		case "pairs":
			return rule.pairs === 1
				? MAKE_CHANCE.pairs1 * 2 * high
				: MAKE_CHANCE.pairs2 * 4 * high;
		case "kind": {
			const chance = rule.count <= 3 ? MAKE_CHANCE.kind3 : MAKE_CHANCE.kind4;
			const dice = rule.score === "all" ? rules.dice : rule.count;
			return chance * dice * high;
		}
		case "straight": {
			const points =
				rule.points === "sum"
					? runSum(rule.from ?? 1, rule.length)
					: rule.points;
			return points * (rule.length >= rules.dice ? 0.35 : 0.65);
		}
		case "fullHouse":
			return 0.4 * (rule.points === "sum" ? 23 : rule.points);
		case "chance":
			return 21;
		case "allSame":
			return 0.25 * rule.points;
	}
}

function utility(rules: ScoresheetRules, option: ScoreOption): number {
	const entry = rules.sheet.find(
		(candidate) => candidate.id === option.category,
	);
	if (!entry) {
		return Number.NEGATIVE_INFINITY;
	}
	let value = option.points - par(rules, entry.rule);
	if (entry.rule.kind === "face" && option.points >= 3 * entry.rule.face) {
		// On pace for the upper bonus.
		value += 3;
	}
	return value;
}

function bestOption(rules: ScoresheetRules, options: readonly ScoreOption[]) {
	let best = options[0];
	let bestValue = Number.NEGATIVE_INFINITY;
	for (const option of options) {
		const value = utility(rules, option);
		if (value > bestValue) {
			best = option;
			bestValue = value;
		}
	}
	return { option: best, value: bestValue };
}

const outcomeCache = new Map<number, Array<{ values: number[]; p: number }>>();

/** Every result of throwing `count` dice as a sorted multiset, with its chance. */
function outcomes(count: number) {
	const cached = outcomeCache.get(count);
	if (cached) {
		return cached;
	}
	const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
	const result: Array<{ values: number[]; p: number }> = [];
	const walk = (values: number[], from: number) => {
		if (values.length === count) {
			const counts = faceCounts(values);
			const ways =
				factorial(count) /
				counts.reduce((product, n) => product * factorial(n), 1);
			result.push({ values: [...values], p: ways / 6 ** count });
			return;
		}
		for (let face = from; face <= 6; face += 1) {
			values.push(face);
			walk(values, face);
			values.pop();
		}
	};
	walk([], 1);
	outcomeCache.set(count, result);
	return result;
}

/** Which dice to keep for the reroll, or null when scoring now is better. */
function planKeep(
	rules: ScoresheetRules,
	scores: Scores,
	dice: readonly number[],
	rollsLeft: number,
) {
	const memo = new Map<string, number>();
	const ratingOf = (values: number[]) => {
		const key = [...values].sort().join("");
		let value = memo.get(key);
		if (value === undefined) {
			value = bestOption(rules, scoreOptions(rules, scores, values)).value;
			memo.set(key, value);
		}
		return value;
	};
	const now = ratingOf([...dice]);
	// One step of lookahead undervalues a reroll that still has another after it.
	const lookaheadBonus = rollsLeft > 1 ? 1.5 : 0;
	let best: { keep: number[]; value: number } | null = null;
	const tried = new Set<string>();
	for (let mask = 0; mask < 2 ** dice.length - 1; mask += 1) {
		const keep = dice.flatMap((_, index) =>
			mask & (1 << index) ? [index] : [],
		);
		const kept = keep.map((index) => dice[index]);
		const key = [...kept].sort().join("");
		if (tried.has(key)) {
			continue;
		}
		tried.add(key);
		let expected = lookaheadBonus;
		for (const outcome of outcomes(dice.length - keep.length)) {
			expected += outcome.p * ratingOf([...kept, ...outcome.values]);
		}
		if (!best || expected > best.value) {
			best = { keep, value: expected };
		}
	}
	return best && best.value > now ? best.keep : null;
}

export function botScoresheetMove(
	rules: ScoresheetRules,
	state: ScoresheetState,
	bots: readonly number[],
): BotMove<ScoresheetAction> | null {
	if (state.phase !== "playing" || !bots.includes(state.turn)) {
		return null;
	}
	const seat = state.turn;
	if (state.rollsUsed === 0) {
		return { seat, action: { type: "roll", keep: [] }, pace: "turn" };
	}
	const scores = state.sheets[seat];
	const rollsLeft = rules.rollsPerTurn - state.rollsUsed;
	const keep =
		rollsLeft > 0 ? planKeep(rules, scores, state.dice, rollsLeft) : null;
	if (keep) {
		return { seat, action: { type: "roll", keep }, pace: "followUp" };
	}
	const { option } = bestOption(rules, scoreOptions(rules, scores, state.dice));
	return {
		seat,
		action: { type: "score", category: option.category },
		pace: "followUp",
	};
}
