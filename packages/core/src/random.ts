/** A source of numbers in [0, 1), like `Math.random`. */
export type Rng = () => number;

/** Deterministic RNG for reproducible puzzles, levels and tests. */
export function mulberry32(seed: number): Rng {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/**
 * A shuffled copy (Fisher-Yates). Draws once per index from the last element
 * down to the second, so a seeded `rng` always gives the same order.
 */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
