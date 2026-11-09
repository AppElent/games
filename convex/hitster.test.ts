import {
	buildSpotifySearchUrl,
	getHitsterCard,
} from "@arcadeclub/core/hitster-packs";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	advance,
	afterCommits,
	arrange,
	createdRows,
	deletedSessionId,
	expectCode,
	fields,
	freezeClock,
	HOST_USER,
	HOSTED,
	hostSession,
	impostors,
	joinWithCode,
	otherGameSession,
	outsider,
	type ParticipantId,
	type SessionId,
	sessionCount,
	setup,
	signedInHost,
	type T,
	T0,
} from "./test.helpers";

freezeClock();

type Mode = "instant" | "original" | "pro" | "expert" | "coop";

const PACK = "normal";
const PACK_SIZE = 48;
/** The start of the `normal` pack. */
const BILLIE_JEAN = { id: "normal-1", year: 1983 };
const ROLLING_STONE = { id: "normal-2", year: 1965 };
const DANCING_QUEEN = { id: "normal-3", year: 1976 };
const ROLLING_DEEP = { id: "normal-4", year: 2010 };

/** The client flow: one `create`. */
async function newRoom(t: T, mode: Mode = "original", targetCards = 5) {
	const host = signedInHost(t);
	const { sessionId, participantId, joinCode } = await host.mutation(
		api.hitster.create,
		{
			...HOSTED,
			mode,
			packId: PACK,
			targetCards,
			turnTimerSeconds: 30,
			playbackMode: "hostDevice",
		},
	);
	return {
		host,
		sessionId,
		hostId: participantId,
		joinCode: joinCode as string,
	};
}

/** What installed mobile builds still do: room session, then `setup` as the host. */
async function twoStepRoom(t: T, mode: Mode = "original", targetCards = 5) {
	const { host, sessionId, hostId, joinCode } = await hostSession(
		t,
		"hitster",
		"room",
		"hostChoice",
	);
	await host.mutation(api.hitster.setup, {
		sessionId,
		participantId: hostId,
		mode,
		packId: PACK,
		targetCards,
		turnTimerSeconds: 30,
		playbackMode: "hostDevice",
	});
	return { host, sessionId, hostId, joinCode: joinCode as string };
}

async function storedState(t: T, sessionId: SessionId) {
	return (await t.run((ctx) =>
		ctx.db
			.query("hitsterGameStates")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.unique(),
	)) as Doc<"hitsterGameStates">;
}

/** Started, with the host's turn. Timelines and the mystery card are fixed. */
async function startedGame(
	t: T,
	options: { mode?: Mode; targetCards?: number; guests?: number } = {},
) {
	const room = await newRoom(t, options.mode, options.targetCards);
	const guests: ParticipantId[] = [];
	for (let index = 0; index < (options.guests ?? 1); index += 1) {
		const joined = await joinWithCode(t, room.joinCode, `guest_${index}`);
		guests.push(joined.participantId);
	}
	await t.mutation(api.hitster.start, {
		sessionId: room.sessionId,
		participantId: room.hostId,
	});
	const stored = await storedState(t, room.sessionId);
	await arrange(t, stored._id, {
		currentCardId: BILLIE_JEAN.id,
		timelines:
			options.mode === "coop"
				? [{ cardIds: [DANCING_QUEEN.id] }]
				: [
						{ participantId: room.hostId, cardIds: [DANCING_QUEEN.id] },
						...guests.map((participantId) => ({
							participantId,
							cardIds: [ROLLING_STONE.id],
						})),
					],
	});
	return { ...room, guests, guest: guests[0], stateId: stored._id };
}

function submitGuess(
	t: T,
	sessionId: SessionId,
	participantId: ParticipantId,
	dropIndex: number,
	answers: {
		artistGuess?: string;
		titleGuess?: string;
		yearGuess?: number;
	} = {},
) {
	return t.mutation(api.hitster.submitGuess, {
		sessionId,
		participantId,
		dropIndex,
		...answers,
	});
}

function submitSteal(
	t: T,
	sessionId: SessionId,
	participantId: ParticipantId,
	dropIndex: number,
	answers: {
		artistGuess?: string;
		titleGuess?: string;
		yearGuess?: number;
	} = {},
) {
	return t.mutation(api.hitster.submitSteal, {
		sessionId,
		participantId,
		dropIndex,
		...answers,
	});
}

function reveal(t: T, sessionId: SessionId, participantId: ParticipantId) {
	return t.mutation(api.hitster.reveal, { sessionId, participantId });
}

function nextRound(t: T, sessionId: SessionId, participantId: ParticipantId) {
	return t.mutation(api.hitster.nextRound, { sessionId, participantId });
}

async function bundle(
	t: T,
	sessionId: SessionId,
	participantId?: ParticipantId,
) {
	const result = await t.query(api.hitster.getBundle, {
		sessionId,
		participantId,
	});
	if (!result?.state) {
		throw new Error("Expected a hitster bundle");
	}
	return { ...result, state: result.state };
}

describe("setup", () => {
	it("creates a lobby state with the host's settings", async () => {
		const t = setup();
		const { sessionId } = await twoStepRoom(t, "original", 7);
		expect(fields(await storedState(t, sessionId))).toEqual({
			sessionId,
			mode: "original",
			packId: PACK,
			targetCards: 7,
			turnTimerSeconds: 30,
			playbackMode: "hostDevice",
			phase: "lobby",
			deck: [],
			roundNumber: 0,
			turnOrder: [],
			activeIndex: 0,
			timelines: [],
			tokens: [],
			stealClaims: [],
			createdAt: T0,
			updatedAt: T0,
		});
	});

	it("patches the settings when run again in the lobby", async () => {
		const t = setup();
		const { host, sessionId, hostId } = await twoStepRoom(t);
		const { _id } = await storedState(t, sessionId);
		advance(1000);
		await expect(
			host.mutation(api.hitster.setup, {
				sessionId,
				participantId: hostId,
				mode: "pro",
				packId: "rock",
				targetCards: 3,
				playbackMode: "hostDevice",
			}),
		).resolves.toBe(_id);
		const stored = await storedState(t, sessionId);
		expect(stored.mode).toBe("pro");
		expect(stored.packId).toBe("rock");
		expect(stored.targetCards).toBe(3);
		expect(stored.turnTimerSeconds).toBeUndefined();
		expect(stored.updatedAt).toBe(T0 + 1000);
		expect(stored.createdAt).toBe(T0);
	});

	function runSetup(
		t: T,
		sessionId: SessionId,
		participantId: ParticipantId,
		overrides: {
			packId?: string;
			targetCards?: number;
			playbackMode?: "hostDevice" | "preview";
		} = {},
	) {
		return t.mutation(api.hitster.setup, {
			sessionId,
			participantId,
			mode: "original",
			packId: PACK,
			targetCards: 5,
			playbackMode: "hostDevice",
			...overrides,
		});
	}

	it("answers notEnoughTracks for an unknown pack, too high a target, or preview audio", async () => {
		const t = setup();
		const { sessionId, hostId } = await hostSession(t, "hitster", "room");
		for (const overrides of [
			{ packId: "nope" },
			{ targetCards: PACK_SIZE - 4 },
			{ playbackMode: "preview" as const },
		]) {
			await expectCode(
				runSetup(t, sessionId, hostId, overrides),
				"notEnoughTracks",
			);
		}
	});

	it("answers targetCardsRange outside 3 to 20", async () => {
		const t = setup();
		const { sessionId, hostId } = await hostSession(t, "hitster", "room");
		for (const targetCards of [2, 21]) {
			await expectCode(
				runSetup(t, sessionId, hostId, { targetCards }),
				"targetCardsRange",
			);
		}
	});

	it("answers hostOnly to a guest and notInGame to an outsider", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newRoom(t);
		const guest = await joinWithCode(t, joinCode, "guest_two");
		await expectCode(runSetup(t, sessionId, guest.participantId), "hostOnly");
		await expectCode(runSetup(t, sessionId, await outsider(t)), "notInGame");
	});

	it("answers gameAlreadyStarted once the session has left the lobby", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t);
		await expectCode(runSetup(t, sessionId, hostId), "gameAlreadyStarted");
	});

	it("answers gameNotFound for another game or a missing session", async () => {
		const t = setup();
		const { hostId } = await hostSession(t, "hitster", "room");
		for (const sessionId of [
			await otherGameSession(t),
			await deletedSessionId(t),
		]) {
			await expectCode(runSetup(t, sessionId, hostId), "gameNotFound");
		}
	});
});

describe("joining", () => {
	it("adds a code joiner as a player and a spectator as a watcher", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newRoom(t);
		const player = await joinWithCode(t, joinCode, "guest_two");
		expect(player).toEqual({
			sessionId,
			participantId: player.participantId,
			gameType: "hitster",
			seatClaimed: false,
		});
		await joinWithCode(t, joinCode, "guest_watch", { asSpectator: true });
		const { participants } = await bundle(t, sessionId);
		expect(participants.map((row) => row.role)).toEqual([
			"host",
			"player",
			"watcher",
		]);
	});

	it("still admits a code joiner mid-game, outside the turn order", async () => {
		const t = setup();
		const { sessionId, joinCode, hostId, guest } = await startedGame(t);
		const late = await joinWithCode(t, joinCode, "guest_late");
		const stored = await storedState(t, sessionId);
		expect(stored.turnOrder).toEqual([hostId, guest]);
		expect(stored.turnOrder).not.toContain(late.participantId);
	});
});

describe("start", () => {
	it("deals a card per player, draws the mystery card, and activates the session", async () => {
		const t = setup();
		const { sessionId, hostId, joinCode } = await newRoom(t);
		const guest = await joinWithCode(t, joinCode, "guest_two");
		await t.mutation(api.hitster.start, { sessionId, participantId: hostId });
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("nowPlaying");
		expect(stored.roundNumber).toBe(1);
		expect(stored.roundStartedAt).toBe(afterCommits(T0));
		expect(stored.turnOrder).toEqual([hostId, guest.participantId]);
		expect(stored.activeIndex).toBe(0);
		expect(stored.deck).toHaveLength(PACK_SIZE - 3);
		expect(stored.timelines.map((entry) => entry.participantId)).toEqual([
			hostId,
			guest.participantId,
		]);
		for (const timeline of stored.timelines) {
			expect(timeline.cardIds).toHaveLength(1);
		}
		expect(stored.tokens).toEqual([
			{ participantId: hostId, tokens: 2 },
			{ participantId: guest.participantId, tokens: 2 },
		]);
		expect(stored.coopTokens).toBeUndefined();
		const dealt = [
			...stored.deck,
			stored.currentCardId,
			...stored.timelines.flatMap((entry) => entry.cardIds),
		];
		expect(new Set(dealt).size).toBe(PACK_SIZE);
		const { session } = await bundle(t, sessionId);
		expect(session.status).toBe("active");
		expect(session.startedAt).toBe(afterCommits(T0));
	});

	it("gives each mode its starting tokens", async () => {
		const t = setup();
		for (const [mode, tokens] of [
			["instant", 0],
			["pro", 5],
			["expert", 3],
		] as const) {
			const { sessionId } = await startedGame(t, { mode });
			const stored = await storedState(t, sessionId);
			expect(stored.tokens.map((entry) => entry.tokens)).toEqual([
				tokens,
				tokens,
			]);
		}
	});

	it("shares one timeline and token pool in coop, and lets a host play alone", async () => {
		const t = setup();
		const { sessionId, hostId } = await newRoom(t, "coop");
		await t.mutation(api.hitster.start, { sessionId, participantId: hostId });
		const stored = await storedState(t, sessionId);
		expect(stored.timelines).toHaveLength(1);
		expect(stored.timelines[0].participantId).toBeUndefined();
		expect(stored.tokens).toEqual([]);
		expect(stored.coopTokens).toBe(5);
		expect(stored.turnOrder).toEqual([hostId]);
	});

	it("leaves watchers out", async () => {
		const t = setup();
		const { sessionId, hostId, joinCode } = await newRoom(t);
		const player = await joinWithCode(t, joinCode, "guest_two");
		await joinWithCode(t, joinCode, "guest_watch", { asSpectator: true });
		await t.mutation(api.hitster.start, { sessionId, participantId: hostId });
		expect((await storedState(t, sessionId)).turnOrder).toEqual([
			hostId,
			player.participantId,
		]);
	});

	it("pins that a kicked player is still dealt in", async () => {
		const t = setup();
		const { host, sessionId, hostId, joinCode } = await newRoom(t);
		const kicked = await joinWithCode(t, joinCode, "guest_kicked");
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: kicked.participantId,
		});
		await t.mutation(api.hitster.start, { sessionId, participantId: hostId });
		expect((await storedState(t, sessionId)).turnOrder).toEqual([
			hostId,
			kicked.participantId,
		]);
	});

	it("answers notEnoughPlayers to a lone host outside coop", async () => {
		const t = setup();
		const { sessionId, hostId, joinCode } = await newRoom(t);
		await joinWithCode(t, joinCode, "guest_watch", { asSpectator: true });
		await expectCode(
			t.mutation(api.hitster.start, { sessionId, participantId: hostId }),
			"notEnoughPlayers",
		);
	});

	it("answers hostOnly to a guest and notInGame to an outsider", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newRoom(t);
		const guest = await joinWithCode(t, joinCode, "guest_two");
		await expectCode(
			t.mutation(api.hitster.start, {
				sessionId,
				participantId: guest.participantId,
			}),
			"hostOnly",
		);
		await expectCode(
			t.mutation(api.hitster.start, {
				sessionId,
				participantId: await outsider(t),
			}),
			"notInGame",
		);
	});

	it("answers gameNotReady ahead of setup and on a second start", async () => {
		const t = setup();
		const bare = await hostSession(t, "hitster", "room");
		await expectCode(
			t.mutation(api.hitster.start, {
				sessionId: bare.sessionId,
				participantId: bare.hostId,
			}),
			"gameNotReady",
		);
		const { sessionId, hostId } = await startedGame(t);
		await expectCode(
			t.mutation(api.hitster.start, { sessionId, participantId: hostId }),
			"gameNotReady",
		);
	});
});

describe("submitGuess", () => {
	it("locks the guess", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t);
		advance(1000);
		await submitGuess(t, sessionId, hostId, 1, {
			artistGuess: "Michael Jackson",
			titleGuess: "Billie Jean",
			yearGuess: 1983,
		});
		expect((await storedState(t, sessionId)).pendingGuess).toEqual({
			participantId: hostId,
			dropIndex: 1,
			artistGuess: "Michael Jackson",
			titleGuess: "Billie Jean",
			yearGuess: 1983,
			submittedAt: T0 + 1000,
		});
	});

	it("answers notYourTurn, guessAlreadyLocked, and invalidDropPosition", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t);
		await expectCode(submitGuess(t, sessionId, guest, 0), "notYourTurn");
		for (const dropIndex of [-1, 2]) {
			await expectCode(
				submitGuess(t, sessionId, hostId, dropIndex),
				"invalidDropPosition",
			);
		}
		await submitGuess(t, sessionId, hostId, 0);
		await expectCode(
			submitGuess(t, sessionId, hostId, 1),
			"guessAlreadyLocked",
		);
	});

	it("answers guessesClosed ahead of the start and after the reveal", async () => {
		const t = setup();
		const lobby = await newRoom(t);
		await expectCode(
			submitGuess(t, lobby.sessionId, lobby.hostId, 0),
			"guessesClosed",
		);
		const bare = await hostSession(t, "hitster", "room");
		await expectCode(
			submitGuess(t, bare.sessionId, bare.hostId, 0),
			"guessesClosed",
		);
		const { sessionId, hostId } = await startedGame(t);
		await reveal(t, sessionId, hostId);
		await expectCode(submitGuess(t, sessionId, hostId, 0), "guessesClosed");
	});

	it("answers notInGame to an outsider and a kicked player", async () => {
		const t = setup();
		const { host, sessionId, hostId, guest } = await startedGame(t);
		await expectCode(
			submitGuess(t, sessionId, await outsider(t), 0),
			"notInGame",
		);
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: guest,
		});
		await expectCode(submitGuess(t, sessionId, guest, 0), "notInGame");
	});

	it("answers timelineNotFound when the active player has no timeline", async () => {
		const t = setup();
		const { sessionId, hostId, stateId } = await startedGame(t);
		await arrange(t, stateId, { timelines: [] });
		await expectCode(submitGuess(t, sessionId, hostId, 0), "timelineNotFound");
	});
});

describe("submitSteal", () => {
	it("records the claim and takes its token up front", async () => {
		const t = setup();
		const { sessionId, guest } = await startedGame(t);
		advance(1000);
		await submitSteal(t, sessionId, guest, 1, { titleGuess: "Billie Jean" });
		const stored = await storedState(t, sessionId);
		expect(stored.stealClaims).toEqual([
			{
				participantId: guest,
				dropIndex: 1,
				titleGuess: "Billie Jean",
				submittedAt: T0 + 1000,
			},
		]);
		expect(
			stored.tokens.find((entry) => entry.participantId === guest),
		).toEqual({ participantId: guest, tokens: 1 });
	});

	it("answers stealsClosed ahead of the start and after the reveal", async () => {
		const t = setup();
		const lobby = await newRoom(t);
		await expectCode(
			submitSteal(t, lobby.sessionId, lobby.hostId, 0),
			"stealsClosed",
		);
		const { sessionId, hostId, guest } = await startedGame(t);
		await reveal(t, sessionId, hostId);
		await expectCode(submitSteal(t, sessionId, guest, 0), "stealsClosed");
	});

	it("answers stealsUnavailable in instant and coop", async () => {
		const t = setup();
		for (const mode of ["instant", "coop"] as const) {
			const { sessionId, guest } = await startedGame(t, { mode });
			await expectCode(
				submitSteal(t, sessionId, guest, 0),
				"stealsUnavailable",
			);
		}
	});

	it("answers activePlayerCannotSteal, notPlaying, and stealAlreadyClaimed", async () => {
		const t = setup();
		const { sessionId, hostId, guest, joinCode } = await startedGame(t);
		await expectCode(
			submitSteal(t, sessionId, hostId, 0),
			"activePlayerCannotSteal",
		);
		const late = await joinWithCode(t, joinCode, "guest_late");
		await expectCode(
			submitSteal(t, sessionId, late.participantId, 0),
			"notPlaying",
		);
		await submitSteal(t, sessionId, guest, 0);
		await expectCode(
			submitSteal(t, sessionId, guest, 0),
			"stealAlreadyClaimed",
		);
	});

	it("answers stealNeedsToken with no tokens and invalidDropPosition off the timeline", async () => {
		const t = setup();
		const { sessionId, hostId, guest, stateId } = await startedGame(t);
		for (const dropIndex of [-1, 2]) {
			await expectCode(
				submitSteal(t, sessionId, guest, dropIndex),
				"invalidDropPosition",
			);
		}
		await arrange(t, stateId, {
			tokens: [
				{ participantId: hostId, tokens: 2 },
				{ participantId: guest, tokens: 0 },
			],
		});
		await expectCode(submitSteal(t, sessionId, guest, 0), "stealNeedsToken");
	});
});

describe("reveal", () => {
	it("puts a correctly placed card on the timeline", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t);
		await submitGuess(t, sessionId, hostId, 1);
		advance(1000);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("reveal");
		expect(stored.timelines[0].cardIds).toEqual([
			DANCING_QUEEN.id,
			BILLIE_JEAN.id,
		]);
		expect(stored.timelines[1].cardIds).toEqual([ROLLING_STONE.id]);
		expect(stored.lastRecap).toEqual({
			roundNumber: 1,
			cardId: BILLIE_JEAN.id,
			activeParticipantId: hostId,
			placementCorrect: true,
			cardWonByParticipantId: hostId,
			tokenChanges: [],
			stealResults: [],
		});
		expect(stored.tokens).toEqual([
			{ participantId: hostId, tokens: 2 },
			{ participantId: guest, tokens: 2 },
		]);
		expect(stored.updatedAt).toBe(T0 + 1000);
		expect((await bundle(t, sessionId)).session.status).toBe("active");
	});

	it("gives nothing for a wrong placement", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t);
		await submitGuess(t, sessionId, hostId, 0);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.timelines[0].cardIds).toEqual([DANCING_QUEEN.id]);
		expect(stored.lastRecap?.placementCorrect).toBe(false);
		expect(stored.lastRecap?.cardWonByParticipantId).toBeUndefined();
	});

	it("treats a missing guess as a miss", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("reveal");
		expect(stored.lastRecap).toEqual({
			roundNumber: 1,
			cardId: BILLIE_JEAN.id,
			activeParticipantId: hostId,
			placementCorrect: false,
			tokenChanges: [],
			stealResults: [],
		});
	});

	it("earns a token for artist and title in original, up to the cap", async () => {
		const t = setup();
		const { sessionId, hostId, guest, stateId } = await startedGame(t);
		const answers = {
			artistGuess: "michael jackson",
			titleGuess: "BILLIE JEAN",
			yearGuess: 1900,
		};
		await submitGuess(t, sessionId, hostId, 1, answers);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.tokens[0].tokens).toBe(3);
		expect(stored.lastRecap?.artistCorrect).toBe(true);
		expect(stored.lastRecap?.titleCorrect).toBe(true);
		expect(stored.lastRecap?.yearCorrect).toBe(false);
		expect(stored.lastRecap?.tokenChanges).toEqual([
			{ participantId: hostId, delta: 1 },
		]);

		await arrange(t, stateId, {
			phase: "nowPlaying",
			pendingGuess: undefined,
			currentCardId: BILLIE_JEAN.id,
			timelines: [
				{ participantId: hostId, cardIds: [DANCING_QUEEN.id] },
				{ participantId: guest, cardIds: [ROLLING_STONE.id] },
			],
			tokens: [
				{ participantId: hostId, tokens: 5 },
				{ participantId: guest, tokens: 2 },
			],
		});
		await submitGuess(t, sessionId, hostId, 1, answers);
		await reveal(t, sessionId, hostId);
		const capped = await storedState(t, sessionId);
		expect(capped.tokens[0].tokens).toBe(5);
		expect(capped.lastRecap?.tokenChanges).toEqual([]);
	});

	it("lets a steal win the card the active player missed", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t);
		await submitGuess(t, sessionId, hostId, 0);
		await submitSteal(t, sessionId, guest, 1);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.timelines[0].cardIds).toEqual([DANCING_QUEEN.id]);
		expect(stored.timelines[1].cardIds).toEqual([
			ROLLING_STONE.id,
			BILLIE_JEAN.id,
		]);
		expect(stored.lastRecap?.cardWonByParticipantId).toBe(guest);
		expect(stored.lastRecap?.tokenChanges).toEqual([
			{ participantId: guest, delta: -1 },
		]);
		expect(stored.lastRecap?.stealResults).toEqual([
			{ participantId: guest, correct: true, wonCard: true },
		]);
		expect(stored.tokens[1].tokens).toBe(1);
	});

	it("keeps the token spent when the active player won anyway", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t);
		await submitGuess(t, sessionId, hostId, 1);
		await submitSteal(t, sessionId, guest, 1);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.timelines[1].cardIds).toEqual([ROLLING_STONE.id]);
		expect(stored.lastRecap?.cardWonByParticipantId).toBe(hostId);
		expect(stored.lastRecap?.stealResults).toEqual([
			{ participantId: guest, correct: true, wonCard: false },
		]);
		expect(stored.tokens[1].tokens).toBe(1);
	});

	it("gives the card to the earliest qualifying steal", async () => {
		const t = setup();
		const { sessionId, hostId, guests } = await startedGame(t, { guests: 3 });
		const [wrong, first, second] = guests;
		await submitSteal(t, sessionId, wrong, 0);
		advance(1000);
		await submitSteal(t, sessionId, first, 1);
		advance(1000);
		await submitSteal(t, sessionId, second, 1);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.lastRecap?.cardWonByParticipantId).toBe(first);
		expect(stored.lastRecap?.stealResults).toEqual([
			{ participantId: wrong, correct: false, wonCard: false },
			{ participantId: first, correct: true, wonCard: true },
			{ participantId: second, correct: true, wonCard: false },
		]);
	});

	it("needs artist and title in pro, for the player and for a steal", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t, { mode: "pro" });
		await submitGuess(t, sessionId, hostId, 1);
		await submitSteal(t, sessionId, guest, 1, {
			artistGuess: "Michael Jackson",
		});
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.lastRecap?.placementCorrect).toBe(true);
		expect(stored.lastRecap?.cardWonByParticipantId).toBeUndefined();
		expect(stored.lastRecap?.stealResults).toEqual([
			{ participantId: guest, correct: false, wonCard: false },
		]);
	});

	it("needs the exact year as well in expert", async () => {
		const t = setup();
		const { sessionId, hostId, stateId, guest } = await startedGame(t, {
			mode: "expert",
		});
		const names = { artistGuess: "Michael Jackson", titleGuess: "Billie Jean" };
		await submitGuess(t, sessionId, hostId, 1, { ...names, yearGuess: 1984 });
		await reveal(t, sessionId, hostId);
		expect(
			(await storedState(t, sessionId)).lastRecap?.cardWonByParticipantId,
		).toBeUndefined();
		await arrange(t, stateId, {
			phase: "nowPlaying",
			pendingGuess: undefined,
			timelines: [
				{ participantId: hostId, cardIds: [DANCING_QUEEN.id] },
				{ participantId: guest, cardIds: [ROLLING_STONE.id] },
			],
		});
		await submitGuess(t, sessionId, hostId, 1, { ...names, yearGuess: 1983 });
		await reveal(t, sessionId, hostId);
		expect(
			(await storedState(t, sessionId)).lastRecap?.cardWonByParticipantId,
		).toBe(hostId);
	});

	it("finishes when a timeline reaches the target", async () => {
		const t = setup();
		const { sessionId, hostId, guest, stateId } = await startedGame(t, {
			targetCards: 3,
		});
		await arrange(t, stateId, {
			timelines: [
				{
					participantId: hostId,
					cardIds: [DANCING_QUEEN.id, ROLLING_DEEP.id],
				},
				{ participantId: guest, cardIds: [ROLLING_STONE.id] },
			],
		});
		await submitGuess(t, sessionId, hostId, 1);
		advance(1000);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("finished");
		expect(stored.winnerParticipantId).toBe(hostId);
		expect(stored.timelines[0].cardIds).toEqual([
			DANCING_QUEEN.id,
			BILLIE_JEAN.id,
			ROLLING_DEEP.id,
		]);
		const { session } = await bundle(t, sessionId);
		expect(session.status).toBe("completed");
		expect(session.completedReason).toBe("finished");
		expect(session.endedAt).toBe(T0 + 1000);
		expect(session.participantCount).toBe(2);
		expect(session.winnerParticipantIds).toEqual([hostId]);
		await expectCode(reveal(t, sessionId, hostId), "nothingToReveal");
		await expectCode(nextRound(t, sessionId, hostId), "finishRevealFirst");
	});

	it("spends a shared token on a coop miss", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t, { mode: "coop" });
		await submitGuess(t, sessionId, hostId, 0);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("reveal");
		expect(stored.coopTokens).toBe(4);
		expect(stored.lastRecap).toEqual({
			roundNumber: 1,
			cardId: BILLIE_JEAN.id,
			activeParticipantId: hostId,
			placementCorrect: false,
			cardWonByTeam: false,
			tokenChanges: [{ delta: -1 }],
			stealResults: [],
		});
	});

	it("adds a coop win to the shared timeline", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t, { mode: "coop" });
		await submitGuess(t, sessionId, hostId, 1);
		await reveal(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.timelines[0].cardIds).toEqual([
			DANCING_QUEEN.id,
			BILLIE_JEAN.id,
		]);
		expect(stored.coopTokens).toBe(5);
		expect(stored.lastRecap?.cardWonByTeam).toBe(true);
		expect(stored.lastRecap?.cardWonByParticipantId).toBeUndefined();
	});

	it("finishes coop as lost on the last token and won at the target", async () => {
		const t = setup();
		const lost = await startedGame(t, { mode: "coop" });
		await arrange(t, lost.stateId, { coopTokens: 1 });
		await reveal(t, lost.sessionId, lost.hostId);
		const lostState = await storedState(t, lost.sessionId);
		expect(lostState.phase).toBe("finished");
		expect(lostState.coopResult).toBe("lost");
		expect(lostState.coopTokens).toBe(0);
		const lostBundle = await bundle(t, lost.sessionId);
		expect(lostBundle.session.status).toBe("completed");
		expect(lostBundle.session.winnerParticipantIds).toEqual([]);

		const won = await startedGame(t, { mode: "coop", targetCards: 3 });
		await arrange(t, won.stateId, {
			timelines: [{ cardIds: [DANCING_QUEEN.id, ROLLING_DEEP.id] }],
		});
		await submitGuess(t, won.sessionId, won.hostId, 1);
		await reveal(t, won.sessionId, won.hostId);
		const wonState = await storedState(t, won.sessionId);
		expect(wonState.phase).toBe("finished");
		expect(wonState.coopResult).toBe("won");
		expect(wonState.winnerParticipantId).toBeUndefined();
	});

	it("answers hostOnly to a guest and nothingToReveal outside a round", async () => {
		const t = setup();
		const lobby = await newRoom(t);
		await expectCode(
			reveal(t, lobby.sessionId, lobby.hostId),
			"nothingToReveal",
		);
		const bare = await hostSession(t, "hitster", "room");
		await expectCode(reveal(t, bare.sessionId, bare.hostId), "nothingToReveal");
		const { sessionId, hostId, guest } = await startedGame(t);
		await expectCode(reveal(t, sessionId, guest), "hostOnly");
		await reveal(t, sessionId, hostId);
		await expectCode(reveal(t, sessionId, hostId), "nothingToReveal");
	});

	it("answers cardNotFound and unknownTimelineCard for ids outside the pack", async () => {
		const t = setup();
		const unknownCard = await startedGame(t);
		await submitGuess(t, unknownCard.sessionId, unknownCard.hostId, 0);
		await arrange(t, unknownCard.stateId, { currentCardId: "nope" });
		await expectCode(
			reveal(t, unknownCard.sessionId, unknownCard.hostId),
			"cardNotFound",
		);
		const unknownTimeline = await startedGame(t);
		await submitGuess(t, unknownTimeline.sessionId, unknownTimeline.hostId, 0);
		await arrange(t, unknownTimeline.stateId, {
			timelines: [{ participantId: unknownTimeline.hostId, cardIds: ["nope"] }],
		});
		await expectCode(
			reveal(t, unknownTimeline.sessionId, unknownTimeline.hostId),
			"unknownTimelineCard",
		);
	});
});

describe("nextRound", () => {
	it("draws the next card and passes the turn, keeping the recap", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t);
		const before = await storedState(t, sessionId);
		await submitGuess(t, sessionId, hostId, 1);
		await submitSteal(t, sessionId, guest, 0);
		await reveal(t, sessionId, hostId);
		advance(1000);
		await nextRound(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("nowPlaying");
		expect(stored.roundNumber).toBe(2);
		expect(stored.activeIndex).toBe(1);
		expect(stored.roundStartedAt).toBe(T0 + 1000);
		expect(stored.currentCardId).toBe(before.deck.at(-1));
		expect(stored.deck).toEqual(before.deck.slice(0, -1));
		expect(stored.pendingGuess).toBeUndefined();
		expect(stored.stealClaims).toEqual([]);
		expect(stored.lastRecap?.roundNumber).toBe(1);
		await expectCode(submitGuess(t, sessionId, hostId, 0), "notYourTurn");
		await submitGuess(t, sessionId, guest, 0);
	});

	it("wraps the turn around", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t);
		await reveal(t, sessionId, hostId);
		await nextRound(t, sessionId, hostId);
		await reveal(t, sessionId, hostId);
		await nextRound(t, sessionId, hostId);
		expect((await storedState(t, sessionId)).activeIndex).toBe(0);
	});

	it("ends on an empty deck, with the longest timeline winning", async () => {
		const t = setup();
		const { sessionId, hostId, guest, stateId } = await startedGame(t);
		await reveal(t, sessionId, hostId);
		await arrange(t, stateId, {
			deck: [],
			timelines: [
				{ participantId: hostId, cardIds: [DANCING_QUEEN.id] },
				{
					participantId: guest,
					cardIds: [ROLLING_STONE.id, ROLLING_DEEP.id],
				},
			],
		});
		advance(1000);
		await nextRound(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("finished");
		expect(stored.currentCardId).toBeUndefined();
		expect(stored.winnerParticipantId).toBe(guest);
		const { session } = await bundle(t, sessionId);
		expect(session.status).toBe("completed");
		expect(session.endedAt).toBe(T0 + 1000);
		expect(session.winnerParticipantIds).toEqual([guest]);
	});

	it("loses coop on an empty deck", async () => {
		const t = setup();
		const { sessionId, hostId, stateId } = await startedGame(t, {
			mode: "coop",
		});
		await reveal(t, sessionId, hostId);
		await arrange(t, stateId, { deck: [] });
		await nextRound(t, sessionId, hostId);
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("finished");
		expect(stored.coopResult).toBe("lost");
		const { session } = await bundle(t, sessionId);
		expect(session.winnerParticipantIds).toEqual([]);
	});

	it("answers finishRevealFirst and hostOnly", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t);
		await expectCode(nextRound(t, sessionId, hostId), "finishRevealFirst");
		await reveal(t, sessionId, hostId);
		await expectCode(nextRound(t, sessionId, guest), "hostOnly");
	});
});

describe("getBundle", () => {
	it("returns a null state and playback ahead of setup", async () => {
		const t = setup();
		const { sessionId, hostId } = await hostSession(t, "hitster", "room");
		const result = await t.query(api.hitster.getBundle, {
			sessionId,
			participantId: hostId,
		});
		expect(Object.keys(result ?? {}).sort()).toEqual([
			"hostPlayback",
			"participants",
			"session",
			"state",
		]);
		expect(result?.state).toBeNull();
		expect(result?.hostPlayback).toBeNull();
	});

	it("is null for a missing session", async () => {
		const t = setup();
		await expect(
			t.query(api.hitster.getBundle, { sessionId: await deletedSessionId(t) }),
		).resolves.toBeNull();
	});

	it("hides the deck and the mystery card, and tells only the host what plays", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t);
		const asHost = await bundle(t, sessionId, hostId);
		expect(asHost.state).not.toHaveProperty("deck");
		expect(asHost.state.deckRemaining).toBe(PACK_SIZE - 3);
		expect(asHost.state.currentCardId).toBeUndefined();
		const card = getHitsterCard(PACK, BILLIE_JEAN.id);
		expect(asHost.hostPlayback).toEqual({
			title: "Billie Jean",
			artistNames: ["Michael Jackson"],
			spotifySearchUrl: buildSpotifySearchUrl(card as NonNullable<typeof card>),
		});
		expect((await bundle(t, sessionId, guest)).hostPlayback).toBeNull();
		expect((await bundle(t, sessionId)).hostPlayback).toBeNull();
	});

	it("hides written answers from everyone but their author until the reveal", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t);
		const guessAnswers = { artistGuess: "A", titleGuess: "T", yearGuess: 1 };
		await submitGuess(t, sessionId, hostId, 1, guessAnswers);
		await submitSteal(t, sessionId, guest, 0, guessAnswers);
		const masked = (participantId: ParticipantId, dropIndex: number) => ({
			participantId,
			dropIndex,
			submittedAt: afterCommits(T0),
		});
		const full = (participantId: ParticipantId, dropIndex: number) => ({
			...masked(participantId, dropIndex),
			...guessAnswers,
		});

		const byGuest = (await bundle(t, sessionId, guest)).state;
		expect(byGuest.pendingGuess).toEqual(masked(hostId, 1));
		expect(byGuest.stealClaims).toEqual([full(guest, 0)]);
		const byHost = (await bundle(t, sessionId, hostId)).state;
		expect(byHost.pendingGuess).toEqual(full(hostId, 1));
		expect(byHost.stealClaims).toEqual([masked(guest, 0)]);
		const byNobody = (await bundle(t, sessionId)).state;
		expect(byNobody.pendingGuess).toEqual(masked(hostId, 1));
		expect(byNobody.stealClaims).toEqual([masked(guest, 0)]);

		await reveal(t, sessionId, hostId);
		const revealed = await bundle(t, sessionId);
		expect(revealed.state.currentCardId).toBe(BILLIE_JEAN.id);
		expect(revealed.state.pendingGuess).toEqual(full(hostId, 1));
		expect(revealed.state.stealClaims).toEqual([full(guest, 0)]);
		expect((await bundle(t, sessionId, hostId)).hostPlayback).toBeNull();
	});
});

const ARGS = {
	...HOSTED,
	mode: "original",
	packId: PACK,
	targetCards: 5,
	turnTimerSeconds: 30,
	playbackMode: "hostDevice",
} as const;

describe("create", () => {
	it("stores what sessions.create and setup store together", async () => {
		const t = setup();
		const twoStep = await twoStepRoom(t);
		// Its own backend, so both paths run at T0 on a fresh commit clock.
		const oneStep = setup();
		const created = await signedInHost(oneStep).mutation(
			api.hitster.create,
			ARGS,
		);
		expect(
			await createdRows(oneStep, created.sessionId, "hitsterGameStates"),
		).toEqual(await createdRows(t, twoStep.sessionId, "hitsterGameStates"));
	});

	it("returns a code a guest can type, and no link", async () => {
		const t = setup();
		const created = await signedInHost(t).mutation(api.hitster.create, ARGS);
		expect(created.shareToken).toBeUndefined();
		const joined = await joinWithCode(
			t,
			created.joinCode as string,
			"guest_two",
		);
		expect(joined.sessionId).toBe(created.sessionId);
	});

	it("needs an account to host, and leaves nothing behind without one", async () => {
		const t = setup();
		await expectCode(t.mutation(api.hitster.create, ARGS), "signInToHost");
		expect(await sessionCount(t)).toBe(0);
	});

	it.each([
		["targetCardsRange", 1],
		["notEnoughTracks", 100_000],
	] as const)("leaves no session behind on %s", async (code, targetCards) => {
		const t = setup();
		await expectCode(
			signedInHost(t).mutation(api.hitster.create, { ...ARGS, targetCards }),
			code,
		);
		expect(await sessionCount(t)).toBe(0);
	});

	it("takes no auth policy, because mobile's and web's act the same", async () => {
		const t = setup();
		const web = await hostSession(t, "hitster", "room", "hostChoice");
		const mobile = await hostSession(t, "hitster", "room", "guestAllowed");
		for (const { joinCode } of [web, mobile]) {
			const joined = await joinWithCode(t, joinCode as string, "guest_anon");
			expect(joined.participantId).toBeDefined();
		}
		await expectCode(
			t.mutation(api.sessions.create, {
				gameType: "hitster",
				joinMode: "room",
				authPolicy: "guestAllowed",
				...HOSTED,
			}),
			"signInToHost",
		);
	});
});

describe("ownership", () => {
	it("answers notInGame to anyone acting for another player's seat", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await startedGame(t);
		for (const caller of impostors(t, { guestIds: ["guest_0"] })) {
			await expectCode(submitGuess(caller, sessionId, hostId, 0), "notInGame");
			await expectCode(reveal(caller, sessionId, hostId), "notInGame");
		}
		for (const caller of impostors(t, { userIds: [HOST_USER] })) {
			await expectCode(submitSteal(caller, sessionId, guest, 0), "notInGame");
		}
		const { state } = await bundle(t, sessionId);
		expect(state.pendingGuess).toBeUndefined();
		expect(state.stealClaims).toEqual([]);
		expect(state.phase).toBe("nowPlaying");
	});

	it("shows the host's song only to the host", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t);
		expect((await bundle(t, sessionId, hostId)).hostPlayback).not.toBeNull();
		for (const caller of impostors(t, { guestIds: ["guest_0"] })) {
			const seen = await caller.query(api.hitster.getBundle, {
				sessionId,
				participantId: hostId,
			});
			expect(seen?.hostPlayback).toBeNull();
		}
	});
});
