import { describe, expect, it } from "vitest";
import { GameRuleError } from "../errors";
import { getHitsterModeConfig, hitsterPlayerView } from "../hitster";
import { advanceHitsterRound, startHitsterGame } from "../hitster-round";
import { mulberry32 } from "../random";

const CARDS = ["c1", "c2", "c3", "c4", "c5", "c6"];

describe("startHitsterGame", () => {
	it("deals each player a start card and draws the round's card from one shuffled deck", () => {
		const game = startHitsterGame("original", CARDS, ["a", "b"], mulberry32(1));
		const dealt = [
			...game.timelines.flatMap((timeline) => timeline.cardIds),
			game.currentCardId,
			...game.deck,
		];
		expect(dealt.sort()).toEqual(CARDS);
		expect(game.timelines.map((timeline) => timeline.participantId)).toEqual([
			"a",
			"b",
		]);
		expect(game.timelines.every((t) => t.cardIds.length === 1)).toBe(true);
		expect(game).toMatchObject({
			phase: "nowPlaying",
			roundNumber: 1,
			turnOrder: ["a", "b"],
			activeIndex: 0,
			coopTokens: undefined,
			stealClaims: [],
		});
	});

	it("gives every player the mode's start tokens", () => {
		const game = startHitsterGame("expert", CARDS, ["a", "b"]);
		const { startTokens } = getHitsterModeConfig("expert");
		expect(game.tokens).toEqual([
			{ participantId: "a", tokens: startTokens },
			{ participantId: "b", tokens: startTokens },
		]);
	});

	it("deals co-op one shared timeline and a team token pool", () => {
		const game = startHitsterGame("coop", CARDS, ["a"]);
		expect(game.timelines).toHaveLength(1);
		expect(game.timelines[0].participantId).toBeUndefined();
		expect(game.tokens).toEqual([]);
		expect(game.coopTokens).toBe(getHitsterModeConfig("coop").startTokens);
	});

	it("needs two players in a competitive mode, one in co-op", () => {
		expect(() => startHitsterGame("original", CARDS, ["a"])).toThrow(
			new GameRuleError("notEnoughPlayers"),
		);
		expect(() => startHitsterGame("coop", CARDS, [])).toThrow(GameRuleError);
	});
});

describe("advanceHitsterRound", () => {
	const revealed = {
		mode: "original" as const,
		deck: ["c5", "c6"],
		roundNumber: 3,
		turnOrder: ["a", "b"],
		activeIndex: 1,
		timelines: [
			{ participantId: "a", cardIds: ["c1"] },
			{ participantId: "b", cardIds: ["c2", "c3"] },
		],
	};

	it("draws the next card for the next player", () => {
		expect(advanceHitsterRound(revealed)).toEqual({
			phase: "nowPlaying",
			deck: ["c5"],
			roundNumber: 4,
			currentCardId: "c6",
			activeIndex: 0,
			pendingGuess: undefined,
			stealClaims: [],
		});
	});

	it("ends with the longest timeline winning once the deck is empty", () => {
		expect(advanceHitsterRound({ ...revealed, deck: [] })).toEqual({
			phase: "finished",
			deck: [],
			currentCardId: undefined,
			winnerParticipantId: "b",
			coopResult: undefined,
		});
	});

	it("names the first of equally long timelines", () => {
		const tied = advanceHitsterRound({
			...revealed,
			deck: [],
			timelines: [
				{ participantId: "a", cardIds: ["c1", "c4"] },
				{ participantId: "b", cardIds: ["c2", "c3"] },
			],
		});
		expect(tied.phase === "finished" && tied.winnerParticipantId).toBe("a");
	});

	it("loses a co-op game whose deck runs out", () => {
		const after = advanceHitsterRound({
			...revealed,
			mode: "coop",
			deck: [],
			timelines: [{ cardIds: ["c1"] }],
		});
		expect(after).toMatchObject({
			phase: "finished",
			winnerParticipantId: undefined,
			coopResult: "lost",
		});
	});
});

describe("hitsterPlayerView", () => {
	const round = {
		mode: "original" as const,
		turnOrder: ["a", "b"],
		activeIndex: 1,
		tokens: [
			{ participantId: "a", tokens: 2 },
			{ participantId: "b", tokens: 0 },
		],
		stealClaims: [{ participantId: "a" }],
		timelines: [
			{ participantId: "a", cardIds: ["c1"] },
			{ participantId: "b", cardIds: ["c2"] },
		],
	};

	it("shows a waiting player their tokens, claim and timeline", () => {
		expect(hitsterPlayerView(round, "a")).toEqual({
			activeParticipantId: "b",
			isPlaying: true,
			isActive: false,
			myTokens: 2,
			hasClaimed: true,
			myTimeline: round.timelines[0],
		});
	});

	it("marks the active player", () => {
		expect(hitsterPlayerView(round, "b")).toMatchObject({
			isActive: true,
			myTokens: 0,
			hasClaimed: false,
		});
	});

	it("leaves a spectator out of the game", () => {
		expect(hitsterPlayerView(round, undefined)).toMatchObject({
			activeParticipantId: "b",
			isPlaying: false,
			isActive: false,
			myTokens: 0,
			myTimeline: undefined,
		});
		expect(
			hitsterPlayerView({ ...round, turnOrder: [] }, undefined).isActive,
		).toBe(false);
	});

	it("puts everyone on the shared timeline in co-op", () => {
		const coop = {
			...round,
			mode: "coop" as const,
			timelines: [{ cardIds: ["c1"] }],
		};
		expect(hitsterPlayerView(coop, "a").myTimeline).toBe(coop.timelines[0]);
	});
});
