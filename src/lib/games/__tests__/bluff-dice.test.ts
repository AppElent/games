import { describe, expect, it } from "vitest";
import {
	describeBluffClaim,
	getBluffWinnerIndex,
	isClaimHigher,
	isValidBluffClaim,
	nextActiveIndex,
	resolveBluffChallenge,
	rollBluffDice,
} from "../bluff-dice";

describe("rollBluffDice", () => {
	it("rolls the requested number of dice in 1-6", () => {
		const sequence = [0, 0.2, 0.4, 0.6, 0.8, 0.999];
		let index = 0;
		const dice = rollBluffDice(6, () => sequence[index++]);
		expect(dice).toEqual([1, 2, 3, 4, 5, 6]);
	});

	it("is deterministic with an injected random", () => {
		const roll = () => rollBluffDice(5, () => 0.5);
		expect(roll()).toEqual(roll());
	});
});

describe("claim validation and ordering", () => {
	it("accepts sane claims and rejects out-of-range ones", () => {
		expect(isValidBluffClaim({ quantity: 3, face: 4 }, 10)).toBe(true);
		expect(isValidBluffClaim({ quantity: 0, face: 4 }, 10)).toBe(false);
		expect(isValidBluffClaim({ quantity: 11, face: 4 }, 10)).toBe(false);
		expect(isValidBluffClaim({ quantity: 2, face: 0 }, 10)).toBe(false);
		expect(isValidBluffClaim({ quantity: 2, face: 7 }, 10)).toBe(false);
		expect(isValidBluffClaim({ quantity: 2.5, face: 3 }, 10)).toBe(false);
	});

	it("requires higher quantity or same quantity with higher face", () => {
		expect(
			isClaimHigher({ quantity: 2, face: 3 }, { quantity: 3, face: 1 }),
		).toBe(true);
		expect(
			isClaimHigher({ quantity: 2, face: 3 }, { quantity: 2, face: 4 }),
		).toBe(true);
		expect(
			isClaimHigher({ quantity: 2, face: 3 }, { quantity: 2, face: 3 }),
		).toBe(false);
		expect(
			isClaimHigher({ quantity: 2, face: 3 }, { quantity: 2, face: 2 }),
		).toBe(false);
		expect(
			isClaimHigher({ quantity: 3, face: 1 }, { quantity: 2, face: 6 }),
		).toBe(false);
	});
});

describe("resolveBluffChallenge", () => {
	const hands = [
		[3, 3, 5],
		[2, 3, 6],
		[1, 4, 3],
	];

	it("challenger loses when the claim holds", () => {
		const outcome = resolveBluffChallenge(hands, { quantity: 4, face: 3 });
		expect(outcome.actualCount).toBe(4);
		expect(outcome.claimWasTrue).toBe(true);
		expect(outcome.loser).toBe("challenger");
	});

	it("claimant loses when the claim is a bluff", () => {
		const outcome = resolveBluffChallenge(hands, { quantity: 5, face: 3 });
		expect(outcome.actualCount).toBe(4);
		expect(outcome.claimWasTrue).toBe(false);
		expect(outcome.loser).toBe("claimant");
	});

	it("counts faces literally with no wilds", () => {
		const outcome = resolveBluffChallenge(hands, { quantity: 1, face: 1 });
		expect(outcome.actualCount).toBe(1);
		expect(outcome.claimWasTrue).toBe(true);
	});
});

describe("turn order and winner", () => {
	it("advances to the next player with dice", () => {
		expect(nextActiveIndex([5, 5, 5], 0)).toBe(1);
		expect(nextActiveIndex([5, 5, 5], 2)).toBe(0);
	});

	it("skips eliminated players", () => {
		expect(nextActiveIndex([5, 0, 5], 0)).toBe(2);
		expect(nextActiveIndex([0, 0, 5, 4], 2)).toBe(3);
		expect(nextActiveIndex([0, 0, 5, 4], 3)).toBe(2);
	});

	it("works for 2 and 8 player loops", () => {
		expect(nextActiveIndex([1, 1], 1)).toBe(0);
		const eight = [1, 1, 1, 1, 1, 1, 1, 1];
		expect(nextActiveIndex(eight, 7)).toBe(0);
	});

	it("detects the winner when one player has dice", () => {
		expect(getBluffWinnerIndex([0, 3, 0])).toBe(1);
		expect(getBluffWinnerIndex([1, 3, 0])).toBeUndefined();
		expect(getBluffWinnerIndex([5, 5, 5])).toBeUndefined();
	});

	it("describes claims", () => {
		expect(describeBluffClaim({ quantity: 3, face: 5 })).toBe("at least 3 × 5");
	});
});
