import { describe, expect, it } from "vitest";
import {
	bluffDiceCounts,
	describeBluffClaim,
	isClaimHigher,
	isValidBluffClaim,
	nextActiveIndex,
	resolveBluffRound,
	rollBluffDice,
	startBluffGame,
} from "../bluff-dice";
import { GameRuleError } from "../errors";

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

	it("describes claims", () => {
		expect(describeBluffClaim({ quantity: 3, face: 5 })).toBe("at least 3 × 5");
	});
});

describe("bluffDiceCounts", () => {
	it("follows turn order and counts a missing hand as zero", () => {
		expect(
			bluffDiceCounts(
				["a", "b", "c"],
				[
					{ participantId: "b", values: [1, 2] },
					{ participantId: "a", values: [3] },
				],
			),
		).toEqual([1, 2, 0]);
	});
});

describe("resolveBluffRound", () => {
	const hands = [
		{ participantId: "a", values: [2, 2] },
		{ participantId: "b", values: [3, 4] },
	];
	const state = { hands, turnOrder: ["a", "b"], roundNumber: 4 };
	const fixedRandom = () => 0;

	it("takes a die from a claimant who overclaimed and lets them start", () => {
		const claim = { quantity: 3, face: 2, byParticipantId: "a" };
		const next = resolveBluffRound(state, claim, "b", fixedRandom);
		expect(next.phase).toBe("claim");
		expect(next.hands.map((hand) => hand.values.length)).toEqual([1, 2]);
		expect(next.activeIndex).toBe(0);
		expect(next.roundNumber).toBe(5);
		expect(next.claimHistory).toEqual([]);
		expect(next.winnerParticipantId).toBeUndefined();
		expect(next.lastReveal).toEqual({
			claim,
			challengerParticipantId: "b",
			actualCount: 2,
			loserParticipantId: "a",
			hands,
		});
	});

	it("takes a die from a challenger when the claim holds", () => {
		const claim = { quantity: 2, face: 2, byParticipantId: "a" };
		const next = resolveBluffRound(state, claim, "b", fixedRandom);
		expect(next.lastReveal.loserParticipantId).toBe("b");
		expect(next.hands.map((hand) => hand.values.length)).toEqual([2, 1]);
		expect(next.activeIndex).toBe(1);
	});

	it("counts faces literally, with no wild ones", () => {
		const claim = { quantity: 2, face: 3, byParticipantId: "a" };
		const next = resolveBluffRound(
			{ ...state, hands: [{ participantId: "a", values: [1, 1] }, hands[1]] },
			claim,
			"b",
			fixedRandom,
		);
		expect(next.lastReveal.actualCount).toBe(1);
		expect(next.lastReveal.loserParticipantId).toBe("a");
	});

	it("finishes when the loser gives up their last die", () => {
		const next = resolveBluffRound(
			{ ...state, hands: [{ participantId: "a", values: [2] }, hands[1]] },
			{ quantity: 3, face: 2, byParticipantId: "a" },
			"b",
			fixedRandom,
		);
		expect(next.phase).toBe("finished");
		expect(next.winnerParticipantId).toBe("b");
		expect(next.activeIndex).toBe(1);
	});
});

describe("startBluffGame", () => {
	it("deals every player five dice in turn order, the first to claim", () => {
		const game = startBluffGame(["a", "b", "c"], () => 0);
		expect(game).toEqual({
			phase: "claim",
			turnOrder: ["a", "b", "c"],
			hands: ["a", "b", "c"].map((participantId) => ({
				participantId,
				values: [1, 1, 1, 1, 1],
			})),
			activeIndex: 0,
			roundNumber: 1,
			claimHistory: [],
			lastReveal: undefined,
			winnerParticipantId: undefined,
		});
	});

	it("needs two to eight players", () => {
		expect(() => startBluffGame(["a"])).toThrow(
			new GameRuleError("needTwoPlayers"),
		);
		expect(startBluffGame(["a", "b"]).hands).toHaveLength(2);
		const nine = Array.from({ length: 9 }, (_, index) => `p${index}`);
		expect(() => startBluffGame(nine)).toThrow(
			new GameRuleError("bluffDiceMaxPlayers"),
		);
		expect(startBluffGame(nine.slice(0, 8)).hands).toHaveLength(8);
	});
});
