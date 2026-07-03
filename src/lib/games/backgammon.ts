export type BackgammonColor = "white" | "black";
export type BackgammonPhase = "waiting" | "ready" | "active" | "finished";
export type BackgammonMoveSource = number | "bar";
export type BackgammonMoveDestination = number | "off";

export type BackgammonPoint = {
	point: number;
	color?: BackgammonColor;
	count: number;
};

export type BackgammonCounters = {
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

export type BackgammonStep = {
	from: BackgammonMoveSource;
	to: BackgammonMoveDestination;
	die: number;
	dieIndex: number;
};

export type BackgammonMovePlan = {
	steps: BackgammonStep[];
};

export type BackgammonMove = {
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

export function countBackgammonCheckers(
	state: Pick<BackgammonTurnState, "points" | "bar" | "off">,
	color: BackgammonColor,
) {
	const onBoard = state.points.reduce(
		(total, point) => total + (point.color === color ? point.count : 0),
		0,
	);
	return onBoard + state.bar[color] + state.off[color];
}

/** Doubles yield four moves, so the roll expands to four dice. */
export function rollBackgammonDice(random = Math.random) {
	const first = rollBackgammonDie(random);
	const second = rollBackgammonDie(random);
	return first === second ? [first, first, first, first] : [first, second];
}

function rollBackgammonDie(random: () => number) {
	return Math.min(6, Math.floor(random() * 6) + 1);
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

export function destinationFor(
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

export function isLandingOpen(
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
			throw new Error("Choose a point with your checker");
		}
		board.bar[color] -= 1;
		return;
	}
	const source = getBackgammonPoint(board, from);
	if (!source || source.color !== color || source.count <= 0) {
		throw new Error("Choose a point with your checker");
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
		throw new Error("Invalid destination");
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
	const color = state.activeColor;
	if (state.bar[color] > 0 && source !== "bar") {
		return { points, off };
	}
	const indexes = availableDieIndexes(state);
	for (const i of indexes) {
		const dest = destinationFor(source, state.dice[i], color);
		if (dest === "off") {
			if (canBearOff(state.points, state.bar, color)) {
				off = true;
			}
		} else if (isLandingOpen(state.points, dest, color)) {
			points.add(dest);
		}
	}
	if (autoCombine && indexes.length >= 2) {
		for (const i of indexes) {
			for (const j of indexes) {
				if (i === j) {
					continue;
				}
				const mid = destinationFor(source, state.dice[i], color);
				if (mid === "off" || !isLandingOpen(state.points, mid, color)) {
					continue;
				}
				const board = cloneBoard(state);
				removeChecker(board, source, color);
				addChecker(board, mid, color);
				const final = destinationFor(mid, state.dice[j], color);
				if (final === "off") {
					if (canBearOff(board.points, board.bar, color)) {
						off = true;
					}
				} else if (isLandingOpen(board.points, final, color)) {
					points.add(final);
				}
			}
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
	const indexes = availableDieIndexes(state);
	for (const i of indexes) {
		if (
			destinationFor(from, state.dice[i], color) === to &&
			stepDestinationOk(state, to, color)
		) {
			return {
				steps: [{ from, to, die: state.dice[i], dieIndex: i }],
			};
		}
	}
	if (autoCombine && indexes.length >= 2) {
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
				if (
					destinationFor(mid, state.dice[j], color) === to &&
					stepDestinationOk(board, to, color)
				) {
					return {
						steps: [
							{ from, to: mid, die: state.dice[i], dieIndex: i },
							{ from: mid, to, die: state.dice[j], dieIndex: j },
						],
					};
				}
			}
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
		throw new Error("It is not your turn");
	}
	if (!canMoveNow(state)) {
		throw new Error("Roll before moving");
	}
	if (state.bar[move.color] > 0 && move.from !== "bar") {
		throw new Error("Enter from the bar first");
	}
	if (move.from === "bar" && state.bar[move.color] <= 0) {
		throw new Error("Choose a point with your checker");
	}
	if (move.from !== "bar") {
		const source = getBackgammonPoint(state, move.from);
		if (!source || source.color !== move.color || source.count <= 0) {
			throw new Error("Choose a point with your checker");
		}
	}
	const plan = planBackgammonMove(state, move.from, move.to, false);
	if (!plan) {
		throw new Error("Invalid destination");
	}
	const next = applyBackgammonPlan(state, plan);
	return { state: next, usedDie: plan.steps[0].die };
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
