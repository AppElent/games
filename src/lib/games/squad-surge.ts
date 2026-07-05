import { mulberry32, type SudokuRng } from "./sudoku";

export { mulberry32 };

/** Forward speed in track units per second. */
export const SPEED = 14;
/** How quickly the squad eases toward the target lane (per second). */
export const LANE_RESPONSIVENESS = 10;

export type GateOp = "mul" | "add" | "sub";
export type Gate = { side: 0 | 1; op: GateOp; value: number };
export type GatePair = { z: number; gates: [Gate, Gate] };
export type Wave = { z: number; strength: number };

export type WeaponId = "pistol" | "smg" | "shotgun" | "minigun";

export type WeaponSpec = {
	id: WeaponId;
	name: string;
	/** Shots per second per soldier. */
	rps: number;
	/** Enemy hit points removed per shot. */
	damage: number;
	/** How far ahead (track units) the squad can hit. */
	range: number;
	tier: number;
	color: string;
};

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
	pistol: {
		id: "pistol",
		name: "Pistol",
		rps: 1.2,
		damage: 1,
		range: 30,
		tier: 0,
		color: "#94a3b8",
	},
	smg: {
		id: "smg",
		name: "SMG",
		rps: 3,
		damage: 1,
		range: 34,
		tier: 1,
		color: "#38bdf8",
	},
	shotgun: {
		id: "shotgun",
		name: "Shotgun",
		rps: 1.4,
		damage: 3,
		range: 27,
		tier: 2,
		color: "#fb923c",
	},
	minigun: {
		id: "minigun",
		name: "Minigun",
		rps: 6,
		damage: 1,
		range: 38,
		tier: 3,
		color: "#f43f5e",
	},
};

/** A weapon crate sitting on one side of the road; run over it to pick it up. */
export type WeaponDrop = { z: number; weapon: WeaponId; lane: number };

export type Level = {
	seed: number;
	difficulty: number;
	/** Total track distance. */
	length: number;
	/** Sorted by z. */
	gatePairs: GatePair[];
	/** Sorted by z. */
	waves: Wave[];
	/** Sorted by z. */
	weaponDrops: WeaponDrop[];
	/** Army needed (strictly more) to win at z === length. */
	boss: number;
	startArmy: number;
};

export type SimStatus = "running" | "won" | "lost";

export type SimState = {
	/** Distance travelled. */
	z: number;
	/** Continuous horizontal position, 0..1 (0 = left gate/side). */
	lane: number;
	/** Integer soldier count, always >= 0. */
	army: number;
	nextGateIdx: number;
	nextWaveIdx: number;
	status: SimStatus;
	elapsed: number;
};

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

export function applyGate(army: number, gate: Gate): number {
	switch (gate.op) {
		case "mul":
			return Math.max(0, Math.floor(army * gate.value));
		case "add":
			return Math.max(0, army + gate.value);
		case "sub":
			return Math.max(0, army - gate.value);
	}
}

export function resolveWave(army: number, strength: number): number {
	return Math.max(0, army - strength);
}

function makeGatePair(rng: SudokuRng, difficulty: number): [Gate, Gate] {
	const goodSide: 0 | 1 = rng() < 0.5 ? 0 : 1;
	const good: Gate =
		rng() < 0.35
			? { side: goodSide, op: "mul", value: 2 }
			: {
					side: goodSide,
					op: "add",
					value: 4 + Math.floor(rng() * (8 + difficulty * 4)),
				};
	const badSide = (1 - goodSide) as 0 | 1;
	const bad: Gate =
		rng() < 0.6
			? {
					side: badSide,
					op: "sub",
					value: 3 + Math.floor(rng() * (6 + difficulty * 4)),
				}
			: { side: badSide, op: "add", value: 1 + Math.floor(rng() * 3) };
	const pair: [Gate, Gate] = goodSide === 0 ? [good, bad] : [bad, good];
	return pair;
}

/**
 * Deterministic level for a (seed, difficulty). Higher difficulty means more
 * gate pairs and waves, stronger waves, and a larger boss. The boss is scaled
 * off a near-optimal playthrough so winning stays possible.
 */
export function generateLevel(seed: number, difficulty: number): Level {
	const rng = mulberry32((seed + difficulty * 0x9e3779b9) >>> 0);
	const gateCount = 4 + difficulty * 2;
	const waveCount = 2 + difficulty * 2;
	const segment = 34;
	const startArmy = 5;

	// Alternate gate → wave down the track, tracking the army a near-optimal
	// player (always picks the better gate) would have. Waves take a
	// difficulty-scaled fraction of that army, never all of it, so a perfect
	// run can always survive; sloppier play runs thinner margins.
	const gatePairs: GatePair[] = [];
	const waves: Wave[] = [];
	let z = segment;
	let placedGates = 0;
	let placedWaves = 0;
	let expected = startArmy;
	while (placedGates < gateCount || placedWaves < waveCount) {
		if (placedGates < gateCount) {
			const gates = makeGatePair(rng, difficulty);
			gatePairs.push({ z, gates });
			expected = Math.max(
				applyGate(expected, gates[0]),
				applyGate(expected, gates[1]),
			);
			placedGates += 1;
			z += segment;
		}
		if (placedWaves < waveCount && placedWaves < placedGates) {
			const frac = 0.18 + difficulty * 0.07 + rng() * 0.15;
			const strength = Math.min(
				expected - 1,
				Math.max(1, Math.floor(expected * frac)),
			);
			if (strength > 0) {
				waves.push({ z, strength });
				expected = resolveWave(expected, strength);
			}
			placedWaves += 1;
			z += segment;
		}
	}
	const length = z + segment;

	// Weapon crates appear at fixed fractions of the track; higher difficulty
	// unlocks later tiers. Each sits on one side so grabbing it is a choice.
	const dropTiers: WeaponId[] = ["smg", "shotgun", "minigun"];
	const dropCount = Math.min(dropTiers.length, 1 + Math.floor(difficulty / 2));
	const weaponDrops: WeaponDrop[] = [];
	for (let i = 0; i < dropCount; i += 1) {
		const frac = (i + 1) / (dropCount + 1);
		weaponDrops.push({
			z: Math.round(length * frac) + 10,
			weapon: dropTiers[i],
			lane: rng() < 0.5 ? 0.25 : 0.75,
		});
	}

	const boss = Math.max(
		1,
		Math.min(expected - 1, Math.floor(expected * (0.5 + difficulty * 0.06))),
	);

	return {
		seed,
		difficulty,
		length,
		gatePairs,
		waves,
		weaponDrops,
		boss,
		startArmy,
	};
}

export function initialState(level: Level): SimState {
	return {
		z: 0,
		lane: 0.5,
		army: level.startArmy,
		nextGateIdx: 0,
		nextWaveIdx: 0,
		status: "running",
		elapsed: 0,
	};
}

export function isTerminal(state: SimState): boolean {
	return state.status !== "running";
}

export function stepSimulation(
	state: SimState,
	input: { targetLane: number },
	dt: number,
	level: Level,
): SimState {
	if (state.status !== "running") {
		return state;
	}

	const z = state.z + SPEED * dt;
	const target = clamp(input.targetLane, 0, 1);
	const ease = Math.min(1, LANE_RESPONSIVENESS * dt);
	const lane = clamp(state.lane + (target - state.lane) * ease, 0, 1);

	let army = state.army;
	let nextGateIdx = state.nextGateIdx;
	let nextWaveIdx = state.nextWaveIdx;
	let status: SimStatus = "running";

	// Resolve crossed gates and waves in z order.
	while (status === "running") {
		const gate = level.gatePairs[nextGateIdx];
		const wave = level.waves[nextWaveIdx];
		const gateZ = gate && gate.z <= z ? gate.z : Infinity;
		const waveZ = wave && wave.z <= z ? wave.z : Infinity;
		if (gateZ === Infinity && waveZ === Infinity) {
			break;
		}
		if (gateZ <= waveZ && gate) {
			const side: 0 | 1 = lane < 0.5 ? 0 : 1;
			const chosen =
				gate.gates[0].side === side ? gate.gates[0] : gate.gates[1];
			army = applyGate(army, chosen);
			nextGateIdx += 1;
		} else if (wave) {
			army = resolveWave(army, wave.strength);
			nextWaveIdx += 1;
			if (army === 0) {
				status = "lost";
			}
		}
	}

	if (status === "running" && z >= level.length) {
		status = army > level.boss ? "won" : "lost";
	}

	return {
		z,
		lane,
		army,
		nextGateIdx,
		nextWaveIdx,
		status,
		elapsed: state.elapsed + dt,
	};
}
