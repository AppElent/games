import { describe, expect, it } from "vitest";
import { getPlayableHitsterCards } from "../hitster-packs";
import { resolveHitsterReveal } from "../hitster-reveal";

const cards = [...getPlayableHitsterCards("rock", "hostDevice")].sort(
	(a, b) => a.releaseYear - b.releaseYear,
);
const oldest = cards[0];
const newest = cards[cards.length - 1];

function originalGame(overrides = {}) {
	return {
		mode: "original" as const,
		packId: "rock",
		targetCards: 10,
		roundNumber: 3,
		turnOrder: ["a", "b"],
		activeIndex: 0,
		timelines: [
			{ participantId: "a", cardIds: [oldest.id] },
			{ participantId: "b", cardIds: [oldest.id] },
		],
		tokens: [
			{ participantId: "a", tokens: 2 },
			{ participantId: "b", tokens: 1 },
		],
		stealClaims: [],
		...overrides,
	};
}

const rightDrop = { dropIndex: 1, submittedAt: 1 };
const wrongDrop = { dropIndex: 0, submittedAt: 1 };

describe("resolveHitsterReveal", () => {
	it("gives the card to an active player who placed it right", () => {
		const after = resolveHitsterReveal(
			originalGame({ pendingGuess: { participantId: "a", ...rightDrop } }),
			newest.id,
		);
		expect(after.timelines[0].cardIds).toEqual([oldest.id, newest.id]);
		expect(after.phase).toBe("reveal");
		expect(after.lastRecap.cardWonByParticipantId).toBe("a");
		expect(after.lastRecap.placementCorrect).toBe(true);
		expect(after.lastRecap.artistCorrect).toBeUndefined();
	});

	it("earns a token for naming the artist and title", () => {
		const after = resolveHitsterReveal(
			originalGame({
				pendingGuess: {
					participantId: "a",
					...rightDrop,
					artistGuess: newest.artistNames[0],
					titleGuess: newest.title,
				},
			}),
			newest.id,
		);
		expect(after.tokens[0].tokens).toBe(3);
		expect(after.lastRecap.tokenChanges).toEqual([
			{ participantId: "a", delta: 1 },
		]);
	});

	it("lets the earliest good steal take a card the active player missed", () => {
		const after = resolveHitsterReveal(
			originalGame({
				pendingGuess: { participantId: "a", ...wrongDrop },
				stealClaims: [{ participantId: "b", dropIndex: 1, submittedAt: 5 }],
			}),
			newest.id,
		);
		expect(after.timelines[0].cardIds).toEqual([oldest.id]);
		expect(after.timelines[1].cardIds).toEqual([oldest.id, newest.id]);
		expect(after.lastRecap.cardWonByParticipantId).toBe("b");
		expect(after.lastRecap.stealResults).toEqual([
			{ participantId: "b", correct: true, wonCard: true },
		]);
		expect(after.lastRecap.tokenChanges).toEqual([
			{ participantId: "b", delta: -1 },
		]);
	});

	it("judges a steal but gives nothing when the active player won the card", () => {
		const after = resolveHitsterReveal(
			originalGame({
				pendingGuess: { participantId: "a", ...rightDrop },
				stealClaims: [{ participantId: "b", dropIndex: 1, submittedAt: 5 }],
			}),
			newest.id,
		);
		expect(after.timelines[1].cardIds).toEqual([oldest.id]);
		expect(after.lastRecap.stealResults).toEqual([
			{ participantId: "b", correct: true, wonCard: false },
		]);
	});

	it("finishes when a timeline reaches the target", () => {
		const after = resolveHitsterReveal(
			originalGame({
				targetCards: 2,
				pendingGuess: { participantId: "a", ...rightDrop },
			}),
			newest.id,
		);
		expect(after.phase).toBe("finished");
		expect(after.winnerParticipantId).toBe("a");
		expect(after.coopResult).toBeUndefined();
	});

	it("plays co-op on the shared timeline and spends a team token on a miss", () => {
		const coop = originalGame({
			mode: "coop",
			timelines: [{ cardIds: [oldest.id] }],
			tokens: [],
			coopTokens: 1,
			pendingGuess: { participantId: "a", ...wrongDrop },
		});
		const lost = resolveHitsterReveal(coop, newest.id);
		expect(lost.coopTokens).toBe(0);
		expect(lost.phase).toBe("finished");
		expect(lost.coopResult).toBe("lost");
		expect(lost.lastRecap.cardWonByParticipantId).toBeUndefined();
		expect(lost.lastRecap.cardWonByTeam).toBe(false);
		expect(lost.lastRecap.tokenChanges).toEqual([
			{ participantId: undefined, delta: -1 },
		]);
	});

	it("treats no guess as a miss", () => {
		const after = resolveHitsterReveal(originalGame(), newest.id);
		expect(after.lastRecap.placementCorrect).toBe(false);
		expect(after.lastRecap.cardWonByParticipantId).toBeUndefined();
		expect(after.timelines[0].cardIds).toEqual([oldest.id]);
	});

	it("does not change the state it was given", () => {
		const game = originalGame({
			pendingGuess: { participantId: "a", ...rightDrop },
		});
		resolveHitsterReveal(game, newest.id);
		expect(game.timelines[0].cardIds).toEqual([oldest.id]);
		expect(game.tokens[0].tokens).toBe(2);
	});

	it("reports an unknown card, then a missing timeline, then a bad timeline card", () => {
		const guess = { pendingGuess: { participantId: "a", ...rightDrop } };
		expect(() => resolveHitsterReveal(originalGame(guess), "nope")).toThrow(
			"cardNotFound",
		);
		expect(() =>
			resolveHitsterReveal(originalGame({ ...guess, timelines: [] }), "nope"),
		).toThrow("cardNotFound");
		expect(() =>
			resolveHitsterReveal(
				originalGame({ ...guess, timelines: [] }),
				newest.id,
			),
		).toThrow("timelineNotFound");
		expect(() =>
			resolveHitsterReveal(
				originalGame({
					...guess,
					timelines: [{ participantId: "a", cardIds: ["nope"] }],
				}),
				newest.id,
			),
		).toThrow("unknownTimelineCard");
		expect(() =>
			resolveHitsterReveal(originalGame({ timelines: [] }), newest.id),
		).toThrow("timelineNotFound");
	});
});
