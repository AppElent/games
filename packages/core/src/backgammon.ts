import { GameRuleError } from "./errors";
import type { Rng } from "./random";

export const BACKGAMMON_COLORS = ["white", "black"] as const;
export type BackgammonColor = (typeof BACKGAMMON_COLORS)[number];

export const BACKGAMMON_PHASES = [
	"waiting",
	"ready",
	"active",
	"finished",
] as const;
export const BACKGAMMON_MOVE_TYPES = ["roll", "move", "endTurn"] as const;

export type BackgammonMoveSource = number | "bar";
export type BackgammonMoveDestination = number | "off";

export type BackgammonPoint = {
	point: number;
	color?: BackgammonColor;
	count: number;
};

type BackgammonCounters = {
	white: number;
	black: number;
};

/**
 * Snapshot of a turn as shared by the board UI, local play, and the Convex
 * mutations. `used` mirrors `dice` index-for-index.
 */
export type BackgammonTurnState = {
	points: BackgammonPoint[];
	bar: BackgammonCounters;
	off: BackgammonCounters;
	activeColor: BackgammonColor;
	dice: number[];
	used: boolean[];
};

type BackgammonStep = {
	from: BackgammonMoveSource;
	to: BackgammonMoveDestination;
	die: number;
	dieIndex: number;
};

export type BackgammonMovePlan = {
	steps: BackgammonStep[];
};

type BackgammonMove = {
	color: BackgammonColor;
	from: BackgammonMoveSource;
	to: BackgammonMoveDestination;
};

const OPENING_POINTS: Array<{
	point: number;
	color: BackgammonColor;
	count: number;
}> = [
	{ point: 1, color: "black", count: 2 },
	{ point: 6, color: "white", count: 5 },
	{ point: 8, color: "white", count: 3 },
	{ point: 12, color: "black", count: 5 },
	{ point: 13, color: "white", count: 5 },
	{ point: 17, color: "black", count: 3 },
	{ point: 19, color: "black", count: 5 },
	{ point: 24, color: "white", count: 2 },
];

export function createInitialBackgammonState(): BackgammonTurnState {
	const points = Array.from({ length: 24 }, (_, index) => ({
		point: index + 1,
		count: 0,
	})) as BackgammonPoint[];
	for (const openingPoint of OPENING_POINTS) {
		points[openingPoint.point - 1] = { ...openingPoint };
	}
	return {
		points,
		bar: { white: 0, black: 0 },
		off: { white: 0, black: 0 },
		activeColor: "white",
		dice: [],
		used: [],
	};
}

export function getBackgammonPoint(
	state: Pick<BackgammonTurnState, "points">,
	point: number,
) {
	if (!Number.isInteger(point) || point < 1 || point > 24) {
		return undefined;
	}
	return state.points[point - 1];
}

/** Doubles yield four moves, so the roll expands to four dice. */
export function rollBackgammonDice(random = Math.random) {
	const first = rollBackgammonDie(random);
	const second = rollBackgammonDie(random);
	return first === second ? [first, first, first, first] : [first, second];
}

function rollBackgammonDie(random: Rng) {
	return Math.min(6, Math.floor(random() * 6) + 1);
}

/** A fresh set of dice, none of them spent. */
export function withBackgammonDice(state: BackgammonTurnState, dice: number[]) {
	return { ...state, dice, used: dice.map(() => false) };
}

export function switchBackgammonColor(color: BackgammonColor): BackgammonColor {
	return color === "white" ? "black" : "white";
}

/**
 * Convex stores the values of spent dice; the engine works with per-index
 * flags. Marks one unused index per spent value.
 */
export function computeUsedFlags(dice: number[], usedDice: number[]) {
	const used = dice.map(() => false);
	for (const value of usedDice) {
		const index = dice.findIndex((die, i) => !used[i] && die === value);
		if (index >= 0) {
			used[index] = true;
		}
	}
	return used;
}

function destinationFor(
	from: BackgammonMoveSource,
	die: number,
	color: BackgammonColor,
): BackgammonMoveDestination {
	if (from === "bar") {
		return color === "white" ? 25 - die : die;
	}
	if (color === "white") {
		const dest = from - die;
		return dest < 1 ? "off" : dest;
	}
	const dest = from + die;
	return dest > 24 ? "off" : dest;
}

function isLandingOpen(
	points: BackgammonPoint[],
	dest: number,
	color: BackgammonColor,
) {
	const target = points[dest - 1];
	return !(target?.color && target.color !== color && target.count >= 2);
}

export function canBearOff(
	points: BackgammonPoint[],
	bar: BackgammonCounters,
	color: BackgammonColor,
) {
	if (bar[color] > 0) {
		return false;
	}
	const lo = color === "white" ? 7 : 1;
	const hi = color === "white" ? 24 : 18;
	for (let n = lo; n <= hi; n++) {
		const point = points[n - 1];
		if (point.color === color && point.count > 0) {
			return false;
		}
	}
	return true;
}

export function availableDieIndexes(
	state: Pick<BackgammonTurnState, "dice" | "used">,
) {
	const out: number[] = [];
	for (let i = 0; i < state.dice.length; i++) {
		if (!state.used[i]) {
			out.push(i);
		}
	}
	return out;
}

export function canMoveNow(state: Pick<BackgammonTurnState, "dice" | "used">) {
	return state.dice.length > 0 && state.used.some((used) => !used);
}

type WorkingBoard = {
	points: BackgammonPoint[];
	bar: BackgammonCounters;
	off: BackgammonCounters;
};

function cloneBoard(state: WorkingBoard): WorkingBoard {
	return {
		points: state.points.map((point) => ({ ...point })),
		bar: { ...state.bar },
		off: { ...state.off },
	};
}

function removeChecker(
	board: WorkingBoard,
	from: BackgammonMoveSource,
	color: BackgammonColor,
) {
	if (from === "bar") {
		if (board.bar[color] <= 0) {
			throw new GameRuleError("choosePointWithChecker");
		}
		board.bar[color] -= 1;
		return;
	}
	const source = getBackgammonPoint(board, from);
	if (!source || source.color !== color || source.count <= 0) {
		throw new GameRuleError("choosePointWithChecker");
	}
	source.count -= 1;
	if (source.count === 0) {
		delete source.color;
	}
}

function addChecker(
	board: WorkingBoard,
	to: BackgammonMoveDestination,
	color: BackgammonColor,
) {
	if (to === "off") {
		board.off[color] += 1;
		return;
	}
	const dest = getBackgammonPoint(board, to);
	if (!dest) {
		throw new GameRuleError("invalidDestination");
	}
	if (dest.color && dest.color !== color) {
		// A lone opposing blot gets hit to the bar.
		board.bar[dest.color] += dest.count;
		dest.count = 0;
		delete dest.color;
	}
	dest.color = color;
	dest.count += 1;
}

function stepDestinationOk(
	board: WorkingBoard,
	dest: BackgammonMoveDestination,
	color: BackgammonColor,
) {
	return dest === "off"
		? canBearOff(board.points, board.bar, color)
		: isLandingOpen(board.points, dest, color);
}

/**
 * Every way to move a checker off `from` with the remaining dice: single dice
 * first, then two-die combinations when `autoCombine` is on.
 */
function* routesFrom(
	state: BackgammonTurnState,
	from: BackgammonMoveSource,
	autoCombine: boolean,
): Generator<BackgammonStep[]> {
	const color = state.activeColor;
	const indexes = availableDieIndexes(state);
	for (const i of indexes) {
		const die = state.dice[i];
		const to = destinationFor(from, die, color);
		if (stepDestinationOk(state, to, color)) {
			yield [{ from, to, die, dieIndex: i }];
		}
	}
	if (!autoCombine || indexes.length < 2) {
		return;
	}
	for (const i of indexes) {
		for (const j of indexes) {
			if (i === j) {
				continue;
			}
			const mid = destinationFor(from, state.dice[i], color);
			if (mid === "off" || !isLandingOpen(state.points, mid, color)) {
				continue;
			}
			const board = cloneBoard(state);
			removeChecker(board, from, color);
			addChecker(board, mid, color);
			const to = destinationFor(mid, state.dice[j], color);
			if (stepDestinationOk(board, to, color)) {
				yield [
					{ from, to: mid, die: state.dice[i], dieIndex: i },
					{ from: mid, to, die: state.dice[j], dieIndex: j },
				];
			}
		}
	}
}

/**
 * Destinations reachable from `source` with the remaining dice. With
 * `autoCombine`, two-die combinations are included as well.
 */
export function getMoveHighlights(
	state: BackgammonTurnState,
	source: BackgammonMoveSource | null,
	autoCombine = true,
): { points: Set<number>; off: boolean } {
	const points = new Set<number>();
	let off = false;
	if (source == null || !canMoveNow(state)) {
		return { points, off };
	}
	if (state.bar[state.activeColor] > 0 && source !== "bar") {
		return { points, off };
	}
	for (const steps of routesFrom(state, source, autoCombine)) {
		const { to } = steps[steps.length - 1];
		if (to === "off") {
			off = true;
		} else {
			points.add(to);
		}
	}
	return { points, off };
}

/**
 * Finds the dice (one, or two combined) that carry a checker from `from` to
 * `to`, or null when the move is not legal right now.
 */
export function planBackgammonMove(
	state: BackgammonTurnState,
	from: BackgammonMoveSource,
	to: BackgammonMoveDestination,
	autoCombine = true,
): BackgammonMovePlan | null {
	if (!canMoveNow(state)) {
		return null;
	}
	const color = state.activeColor;
	if (state.bar[color] > 0 && from !== "bar") {
		// Checkers on the bar must re-enter first.
		return null;
	}
	if (from !== "bar") {
		const source = getBackgammonPoint(state, from);
		if (!source || source.color !== color || source.count <= 0) {
			return null;
		}
	} else if (state.bar[color] <= 0) {
		return null;
	}
	for (const steps of routesFrom(state, from, autoCombine)) {
		if (steps[steps.length - 1].to === to) {
			return { steps };
		}
	}
	return null;
}

/** Applies a full plan (one or two steps) and marks the dice as spent. */
export function applyBackgammonPlan(
	state: BackgammonTurnState,
	plan: BackgammonMovePlan,
): BackgammonTurnState {
	const color = state.activeColor;
	const board = cloneBoard(state);
	const used = [...state.used];
	for (const step of plan.steps) {
		removeChecker(board, step.from, color);
		addChecker(board, step.to, color);
		used[step.dieIndex] = true;
	}
	return {
		points: board.points,
		bar: board.bar,
		off: board.off,
		activeColor: state.activeColor,
		dice: [...state.dice],
		used,
	};
}

/**
 * Validates and applies a single-die move. This is the server-side entry
 * point: combined moves arrive as two separate calls.
 */
export function applyBackgammonMove(
	state: BackgammonTurnState,
	move: BackgammonMove,
): { state: BackgammonTurnState; usedDie: number } {
	if (move.color !== state.activeColor) {
		throw new GameRuleError("notYourTurn");
	}
	if (!canMoveNow(state)) {
		throw new GameRuleError("rollBeforeMoving");
	}
	if (state.bar[move.color] > 0 && move.from !== "bar") {
		throw new GameRuleError("enterFromBarFirst");
	}
	if (move.from === "bar" && state.bar[move.color] <= 0) {
		throw new GameRuleError("choosePointWithChecker");
	}
	if (move.from !== "bar") {
		const source = getBackgammonPoint(state, move.from);
		if (!source || source.color !== move.color || source.count <= 0) {
			throw new GameRuleError("choosePointWithChecker");
		}
	}
	const plan = planBackgammonMove(state, move.from, move.to, false);
	if (!plan) {
		throw new GameRuleError("invalidDestination");
	}
	const next = applyBackgammonPlan(state, plan);
	return { state: next, usedDie: plan.steps[0].die };
}

/**
 * Whether the active player can still use any remaining die. When this is
 * false after a roll, the only legal action is to end the turn.
 */
export function hasLegalBackgammonMove(state: BackgammonTurnState) {
	if (!canMoveNow(state)) {
		return false;
	}
	const color = state.activeColor;
	const sources: BackgammonMoveSource[] =
		state.bar[color] > 0
			? ["bar"]
			: state.points
					.filter((point) => point.color === color && point.count > 0)
					.map((point) => point.point);
	return sources.some((source) => {
		const highlights = getMoveHighlights(state, source, false);
		return highlights.off || highlights.points.size > 0;
	});
}

/**
 * Whether the active player may end the turn: after rolling, once every die
 * is used or no remaining die can be played.
 */
export function canEndBackgammonTurn(state: BackgammonTurnState) {
	return state.dice.length > 0 && !hasLegalBackgammonMove(state);
}

export function getBackgammonWinner(
	off: BackgammonCounters,
): BackgammonColor | null {
	if (off.white >= 15) {
		return "white";
	}
	if (off.black >= 15) {
		return "black";
	}
	return null;
}

/** All dice are spent and the game goes on: only ending the turn is left. */
export function isTurnSpent(state: BackgammonTurnState) {
	return (
		state.dice.length > 0 &&
		state.used.every(Boolean) &&
		getBackgammonWinner(state.off) === null
	);
}
