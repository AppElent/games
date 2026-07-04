export type BluffClaim = {
	quantity: number;
	face: number;
};

export const BLUFF_STARTING_DICE = 5;
export const BLUFF_MIN_PLAYERS = 2;
export const BLUFF_MAX_PLAYERS = 8;

export function rollBluffDice(
	count: number,
	random: () => number = Math.random,
) {
	return Array.from({ length: count }, () => 1 + Math.floor(random() * 6));
}

export function isValidBluffClaim(claim: BluffClaim, totalDice: number) {
	return (
		Number.isInteger(claim.quantity) &&
		Number.isInteger(claim.face) &&
		claim.face >= 1 &&
		claim.face <= 6 &&
		claim.quantity >= 1 &&
		claim.quantity <= totalDice
	);
}

/**
 * A new claim must outrank the previous one: higher quantity, or the
 * same quantity with a higher face. Faces are literal — no wilds.
 */
export function isClaimHigher(previous: BluffClaim, next: BluffClaim) {
	if (next.quantity > previous.quantity) {
		return true;
	}
	return next.quantity === previous.quantity && next.face > previous.face;
}

export type BluffChallengeOutcome = {
	/** How many dice actually show the claimed face across all hands. */
	actualCount: number;
	claimWasTrue: boolean;
	/** "claimant" loses when the claim was false, "challenger" when true. */
	loser: "claimant" | "challenger";
};

export function resolveBluffChallenge(
	allDice: readonly number[][],
	claim: BluffClaim,
): BluffChallengeOutcome {
	const actualCount = allDice.flat().filter((die) => die === claim.face).length;
	const claimWasTrue = actualCount >= claim.quantity;
	return {
		actualCount,
		claimWasTrue,
		loser: claimWasTrue ? "challenger" : "claimant",
	};
}

/**
 * Index of the next active (non-eliminated) player after `fromIndex`.
 * Returns fromIndex itself if no one else has dice left.
 */
export function nextActiveIndex(
	diceCounts: readonly number[],
	fromIndex: number,
) {
	for (let step = 1; step <= diceCounts.length; step += 1) {
		const index = (fromIndex + step) % diceCounts.length;
		if (diceCounts[index] > 0) {
			return index;
		}
	}
	return fromIndex;
}

export function getBluffWinnerIndex(diceCounts: readonly number[]) {
	const alive = diceCounts
		.map((count, index) => ({ count, index }))
		.filter((entry) => entry.count > 0);
	return alive.length === 1 ? alive[0].index : undefined;
}

export function describeBluffClaim(claim: BluffClaim) {
	return `at least ${claim.quantity} × ${claim.face}`;
}
