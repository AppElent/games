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

export type BackgammonPrototypeState = {
	points: BackgammonPoint[];
	bar: BackgammonCounters;
	off: BackgammonCounters;
	activeColor: BackgammonColor;
	dice: number[];
	usedDice: number[];
};

export type BackgammonPrototypeMove = {
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

export function createInitialBackgammonState(): BackgammonPrototypeState {
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
		usedDice: [],
	};
}

export function getBackgammonPoint(
	state: Pick<BackgammonPrototypeState, "points">,
	point: number,
) {
	if (!Number.isInteger(point) || point < 1 || point > 24) {
		return undefined;
	}
	return state.points[point - 1];
}

export function countBackgammonCheckers(
	state: BackgammonPrototypeState,
	color: BackgammonColor,
) {
	const onBoard = state.points.reduce(
		(total, point) => total + (point.color === color ? point.count : 0),
		0,
	);
	return onBoard + state.bar[color] + state.off[color];
}

export function rollBackgammonDice(random = Math.random) {
	return [rollBackgammonDie(random), rollBackgammonDie(random)];
}

function rollBackgammonDie(random: () => number) {
	return Math.min(6, Math.floor(random() * 6) + 1);
}

export function switchBackgammonColor(color: BackgammonColor): BackgammonColor {
	return color === "white" ? "black" : "white";
}

export function applyBackgammonPrototypeMove(
	state: BackgammonPrototypeState,
	move: BackgammonPrototypeMove,
) {
	if (state.dice.length === 0) {
		throw new Error("Roll before moving");
	}

	const points = state.points.map((point) => ({ ...point }));
	const nextState: BackgammonPrototypeState = {
		points,
		bar: { ...state.bar },
		off: { ...state.off },
		activeColor: state.activeColor,
		dice: [...state.dice],
		usedDice: [...state.usedDice],
	};

	removeSourceChecker(nextState, move);
	addDestinationChecker(nextState, move);

	const usedDie = state.dice.find((die, index) => index >= state.usedDice.length);
	if (usedDie !== undefined) {
		nextState.usedDice = [...state.usedDice, usedDie];
	}

	return { state: nextState, usedDie };
}

function removeSourceChecker(
	state: BackgammonPrototypeState,
	move: BackgammonPrototypeMove,
) {
	if (move.from === "bar") {
		if (state.bar[move.color] <= 0) {
			throw new Error("Choose a point with your checker");
		}
		state.bar[move.color] -= 1;
		return;
	}

	const source = getBackgammonPoint(state, move.from);
	if (!source || source.color !== move.color || source.count <= 0) {
		throw new Error("Choose a point with your checker");
	}
	source.count -= 1;
	if (source.count === 0) {
		delete source.color;
	}
}

function addDestinationChecker(
	state: BackgammonPrototypeState,
	move: BackgammonPrototypeMove,
) {
	if (move.to === "off") {
		state.off[move.color] += 1;
		return;
	}

	const destination = getBackgammonPoint(state, move.to);
	if (!destination) {
		throw new Error("Invalid destination");
	}
	destination.color = move.color;
	destination.count += 1;
}
