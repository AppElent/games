import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	advance,
	afterCommits,
	deletedParticipantId,
	deletedSessionId,
	expectCode,
	fields,
	fixRandom,
	freezeClock,
	HOSTED,
	hostSession,
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

/** Every die lands on this face while `fixRandom(ALL_FOURS)` is active. */
const ALL_FOURS = 0.5;
const FOURS = [4, 4, 4, 4, 4];

/** The client flow: one `create`. */
async function newRoom(t: T) {
	const host = signedInHost(t);
	const { sessionId, participantId, joinCode } = await host.mutation(
		api.bluffDice.create,
		HOSTED,
	);
	return {
		host,
		sessionId,
		hostId: participantId,
		joinCode: joinCode as string,
	};
}

/** A started game with the host first in turn order, and all dice on fours. */
async function startedGame(t: T, guests = 1) {
	const room = await newRoom(t);
	const others: ParticipantId[] = [];
	for (let index = 0; index < guests; index += 1) {
		const joined = await joinWithCode(t, room.joinCode, `guest_${index}`);
		others.push(joined.participantId);
	}
	fixRandom(ALL_FOURS);
	await t.mutation(api.bluffDice.start, {
		sessionId: room.sessionId,
		participantId: room.hostId,
	});
	return { ...room, others, players: [room.hostId, ...others] };
}

async function bundle(t: T, sessionId: SessionId) {
	const result = await t.query(api.bluffDice.getBundle, { sessionId });
	if (!result?.state) {
		throw new Error("Expected a bluff dice bundle");
	}
	return { ...result, state: result.state };
}

async function storedState(t: T, sessionId: SessionId) {
	const state = (await t.run((ctx) =>
		ctx.db
			.query("bluffDiceStates")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.unique(),
	)) as Doc<"bluffDiceStates">;
	return state;
}

function claim(
	t: T,
	sessionId: SessionId,
	participantId: ParticipantId,
	quantity: number,
	face: number,
) {
	return t.mutation(api.bluffDice.submitClaim, {
		sessionId,
		participantId,
		quantity,
		face,
	});
}

function challenge(t: T, sessionId: SessionId, participantId: ParticipantId) {
	return t.mutation(api.bluffDice.challenge, { sessionId, participantId });
}

/** One round in which `claimant` lies (no die shows a 1) and is called out. */
async function loseRound(
	t: T,
	sessionId: SessionId,
	claimant: ParticipantId,
	challenger: ParticipantId,
) {
	await claim(t, sessionId, claimant, 1, 1);
	await challenge(t, sessionId, challenger);
}

async function finishedGame(t: T) {
	const game = await startedGame(t);
	const [host, guest] = game.players;
	for (let round = 0; round < 5; round += 1) {
		await loseRound(t, game.sessionId, host, guest);
	}
	return { ...game, host, guest };
}

describe("new room", () => {
	it("creates an empty lobby state", async () => {
		const t = setup();
		const { sessionId } = await newRoom(t);
		const { state, session } = await bundle(t, sessionId);
		expect(fields(state)).toEqual({
			sessionId,
			phase: "lobby",
			turnOrder: [],
			diceCounts: [],
			activeIndex: 0,
			roundNumber: 0,
			claimHistory: [],
			createdAt: T0,
			updatedAt: T0,
		});
		expect(session.status).toBe("lobby");
		expect(session.joinCode).toMatch(/^[A-Z2-9]{6}$/);
	});
});

describe("joining", () => {
	it("adds a code joiner as an unseated player", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newRoom(t);
		const joined = await joinWithCode(t, joinCode, "guest_two");
		expect(joined).toEqual({
			sessionId,
			participantId: joined.participantId,
			gameType: "bluff-dice",
			seatClaimed: false,
		});
		const { participants } = await bundle(t, sessionId);
		expect(fields(participants[1])).toEqual({
			sessionId,
			guestId: "guest_two",
			displayName: "guest_two",
			role: "player",
			connected: true,
			lastSeen: T0,
		});
	});

	it("adds a spectator as a watcher", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newRoom(t);
		await joinWithCode(t, joinCode, "guest_watch", { asSpectator: true });
		expect((await bundle(t, sessionId)).participants[1].role).toBe("watcher");
	});
});

describe("start", () => {
	it("deals five dice each, in join order, and activates the session", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t, 2);
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("claim");
		expect(stored.turnOrder).toEqual(players);
		expect(stored.hands).toEqual(
			players.map((participantId) => ({ participantId, values: FOURS })),
		);
		expect(stored.activeIndex).toBe(0);
		expect(stored.roundNumber).toBe(1);
		const { session } = await bundle(t, sessionId);
		expect(session.status).toBe("active");
		expect(session.startedAt).toBe(afterCommits(T0));
		expect(session.endedAt).toBeUndefined();
	});

	it("leaves watchers out", async () => {
		const t = setup();
		const { sessionId, hostId, joinCode } = await newRoom(t);
		const player = await joinWithCode(t, joinCode, "guest_two");
		await joinWithCode(t, joinCode, "guest_watch", { asSpectator: true });
		await t.mutation(api.bluffDice.start, { sessionId, participantId: hostId });
		expect((await storedState(t, sessionId)).turnOrder).toEqual([
			hostId,
			player.participantId,
		]);
	});

	it("pins that a kicked player is still dealt in", async () => {
		const t = setup();
		const { host, sessionId, hostId, joinCode } = await newRoom(t);
		const player = await joinWithCode(t, joinCode, "guest_two");
		const kicked = await joinWithCode(t, joinCode, "guest_kicked");
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: kicked.participantId,
		});
		await t.mutation(api.bluffDice.start, { sessionId, participantId: hostId });
		expect((await storedState(t, sessionId)).turnOrder).toEqual([
			hostId,
			player.participantId,
			kicked.participantId,
		]);
	});

	it("answers hostOnlyStart to a guest", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newRoom(t);
		const joined = await joinWithCode(t, joinCode, "guest_two");
		await expectCode(
			t.mutation(api.bluffDice.start, {
				sessionId,
				participantId: joined.participantId,
			}),
			"hostOnlyStart",
		);
	});

	it("answers needTwoPlayers to a lone host, not counting watchers", async () => {
		const t = setup();
		const { sessionId, hostId, joinCode } = await newRoom(t);
		await joinWithCode(t, joinCode, "guest_watch", { asSpectator: true });
		await expectCode(
			t.mutation(api.bluffDice.start, { sessionId, participantId: hostId }),
			"needTwoPlayers",
		);
	});

	it("answers bluffDiceMaxPlayers above eight players", async () => {
		const t = setup();
		const { sessionId, hostId, joinCode } = await newRoom(t);
		for (let index = 0; index < 8; index += 1) {
			await joinWithCode(t, joinCode, `guest_${index}`);
		}
		await expectCode(
			t.mutation(api.bluffDice.start, { sessionId, participantId: hostId }),
			"bluffDiceMaxPlayers",
		);
	});

	it("answers gameAlreadyStarted on a second start", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t);
		await expectCode(
			t.mutation(api.bluffDice.start, { sessionId, participantId: hostId }),
			"gameAlreadyStarted",
		);
	});

	it("answers gameNotFound for another game, a missing session, or no state", async () => {
		const t = setup();
		const { sessionId: noState, hostId } = await hostSession(
			t,
			"bluff-dice",
			"room",
		);
		for (const sessionId of [
			await otherGameSession(t),
			await deletedSessionId(t),
			noState,
		]) {
			await expectCode(
				t.mutation(api.bluffDice.start, { sessionId, participantId: hostId }),
				"gameNotFound",
			);
		}
	});
});

describe("submitClaim", () => {
	it("records the claim and passes the turn", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t, 2);
		advance(1000);
		await claim(t, sessionId, players[0], 2, 3);
		const { state } = await bundle(t, sessionId);
		expect(state.claimHistory).toEqual([
			{ quantity: 2, face: 3, byParticipantId: players[0] },
		]);
		expect(state.activeIndex).toBe(1);
		expect(state.updatedAt).toBe(T0 + 1000);
	});

	it("answers notYourTurn out of turn", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t);
		await expectCode(claim(t, sessionId, players[1], 1, 1), "notYourTurn");
	});

	it("answers noActiveRound in the lobby", async () => {
		const t = setup();
		const { sessionId, hostId } = await newRoom(t);
		await expectCode(claim(t, sessionId, hostId, 1, 1), "noActiveRound");
	});

	it("answers claimImpossible for a claim the table cannot hold", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t);
		for (const [quantity, face] of [
			[0, 1],
			[11, 1],
			[1, 0],
			[1, 7],
			[1.5, 1],
		]) {
			await expectCode(
				claim(t, sessionId, players[0], quantity, face),
				"claimImpossible",
			);
		}
	});

	it("answers claimMustOutrank unless quantity or face goes up", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t);
		await claim(t, sessionId, players[0], 2, 3);
		for (const [quantity, face] of [
			[2, 3],
			[2, 2],
			[1, 6],
		]) {
			await expectCode(
				claim(t, sessionId, players[1], quantity, face),
				"claimMustOutrank",
			);
		}
		await claim(t, sessionId, players[1], 2, 4);
	});
});

describe("challenge", () => {
	it("costs a false claimant a die and hands them the next round", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t);
		await claim(t, sessionId, players[0], 1, 1);
		advance(1000);
		await challenge(t, sessionId, players[1]);
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("claim");
		expect(state.activeIndex).toBe(0);
		expect(state.roundNumber).toBe(2);
		expect(state.claimHistory).toEqual([]);
		expect(state.updatedAt).toBe(T0 + 1000);
		expect(state.diceCounts).toEqual([
			{ participantId: players[0], count: 4 },
			{ participantId: players[1], count: 5 },
		]);
		expect(state.lastReveal).toEqual({
			claim: { quantity: 1, face: 1, byParticipantId: players[0] },
			challengerParticipantId: players[1],
			actualCount: 0,
			loserParticipantId: players[0],
			hands: [
				{ participantId: players[0], values: FOURS },
				{ participantId: players[1], values: FOURS },
			],
		});
		expect(state.winnerParticipantId).toBeUndefined();
	});

	it("answers noClaimToChallenge ahead of any claim", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t);
		await expectCode(challenge(t, sessionId, players[0]), "noClaimToChallenge");
	});

	it("answers notYourTurn to anyone but the next player", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t, 2);
		await claim(t, sessionId, players[0], 1, 1);
		await expectCode(challenge(t, sessionId, players[2]), "notYourTurn");
	});

	it("answers noActiveRound in the lobby", async () => {
		const t = setup();
		const { sessionId, hostId } = await newRoom(t);
		await expectCode(challenge(t, sessionId, hostId), "noActiveRound");
	});

	it("skips an eliminated player and keeps them in turn order", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t, 2);
		const [host, second, third] = players;
		for (let round = 0; round < 5; round += 1) {
			await claim(t, sessionId, host, 1, 1);
			await challenge(t, sessionId, second);
		}
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("claim");
		expect(state.turnOrder).toEqual(players);
		expect(state.activeIndex).toBe(1);
		expect(state.diceCounts.map((entry) => entry.count)).toEqual([0, 5, 5]);
		await claim(t, sessionId, second, 1, 1);
		expect((await bundle(t, sessionId)).state.activeIndex).toBe(2);
		await claim(t, sessionId, third, 1, 2);
		expect((await bundle(t, sessionId)).state.activeIndex).toBe(1);
		await expect(
			t.query(api.bluffDice.getMyDice, { sessionId, participantId: host }),
		).resolves.toEqual([]);
	});

	it("finishes when one player has dice left", async () => {
		const t = setup();
		const { sessionId, guest } = await finishedGame(t);
		const { state, session } = await bundle(t, sessionId);
		expect(state.phase).toBe("finished");
		expect(state.winnerParticipantId).toBe(guest);
		expect(state.roundNumber).toBe(6);
		expect(state.diceCounts.map((entry) => entry.count)).toEqual([0, 5]);
		expect(state.activeIndex).toBe(1);
		expect(session.status).toBe("completed");
		expect(session.completedReason).toBe("finished");
		expect(session.endedAt).toBe(afterCommits(T0));
		expect(session.participantCount).toBe(2);
		expect(session.winnerParticipantIds).toEqual([guest]);
		await expectCode(claim(t, sessionId, guest, 1, 1), "noActiveRound");
		await expectCode(challenge(t, sessionId, guest), "noActiveRound");
	});
});

describe("rematch", () => {
	it("deals everyone back in and reopens the session", async () => {
		const t = setup();
		const { sessionId, host, guest } = await finishedGame(t);
		advance(5000);
		await t.mutation(api.bluffDice.rematch, { sessionId, participantId: host });
		const stored = await storedState(t, sessionId);
		expect(fields(stored)).toEqual({
			sessionId,
			phase: "claim",
			turnOrder: [host, guest],
			hands: [
				{ participantId: host, values: FOURS },
				{ participantId: guest, values: FOURS },
			],
			activeIndex: 0,
			roundNumber: 1,
			claimHistory: [],
			createdAt: T0,
			updatedAt: T0 + 5000,
		});
		const { session } = await bundle(t, sessionId);
		expect(session.status).toBe("active");
		expect(session.startedAt).toBe(afterCommits(T0));
		expect(session.endedAt).toBeUndefined();
		expect(session.completedReason).toBeUndefined();
		expect(session.winnerParticipantIds).toBeUndefined();
		expect(session.participantCount).toBe(2);
	});

	it("answers hostOnlyRematch to a guest, even the winner", async () => {
		const t = setup();
		const { sessionId, guest } = await finishedGame(t);
		await expectCode(
			t.mutation(api.bluffDice.rematch, { sessionId, participantId: guest }),
			"hostOnlyRematch",
		);
	});

	it("answers currentGameNotFinished during play", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t);
		await expectCode(
			t.mutation(api.bluffDice.rematch, { sessionId, participantId: hostId }),
			"currentGameNotFinished",
		);
	});
});

describe("getBundle", () => {
	it("strips dice values and exposes counts instead", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t);
		const result = await t.query(api.bluffDice.getBundle, { sessionId });
		expect(Object.keys(result ?? {}).sort()).toEqual([
			"participants",
			"session",
			"state",
		]);
		expect(result?.state).not.toHaveProperty("hands");
		expect(result?.state?.diceCounts).toEqual([
			{ participantId: players[0], count: 5 },
			{ participantId: players[1], count: 5 },
		]);
	});

	it("is null for a missing session, and state is null on a session without one", async () => {
		const t = setup();
		await expect(
			t.query(api.bluffDice.getBundle, {
				sessionId: await deletedSessionId(t),
			}),
		).resolves.toBeNull();
		const { sessionId } = await hostSession(t, "bluff-dice", "room");
		const result = await t.query(api.bluffDice.getBundle, { sessionId });
		expect(result?.state).toBeNull();
		expect(result?.participants).toHaveLength(1);
	});
});

describe("getMyDice", () => {
	it("returns the caller's own dice", async () => {
		const t = setup();
		const { sessionId, players } = await startedGame(t);
		await expect(
			t.query(api.bluffDice.getMyDice, {
				sessionId,
				participantId: players[1],
			}),
		).resolves.toEqual(FOURS);
	});

	it("pins that a public participant id is enough to read a hand", async () => {
		const t = setup();
		const { sessionId } = await startedGame(t);
		const { participants } = await bundle(t, sessionId);
		const anonymous = await t.query(api.bluffDice.getMyDice, {
			sessionId,
			participantId: participants[0]._id,
		});
		expect(anonymous).toEqual(FOURS);
		const stranger = t.withIdentity({ subject: "user_stranger" });
		await expect(
			stranger.query(api.bluffDice.getMyDice, {
				sessionId,
				participantId: participants[1]._id,
			}),
		).resolves.toEqual(FOURS);
	});

	it("is null for a watcher, or ahead of the state", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newRoom(t);
		const watcher = await joinWithCode(t, joinCode, "guest_watch", {
			asSpectator: true,
		});
		await expect(
			t.query(api.bluffDice.getMyDice, {
				sessionId,
				participantId: watcher.participantId,
			}),
		).resolves.toBeNull();
		const bare = await hostSession(t, "bluff-dice", "room");
		await expect(
			t.query(api.bluffDice.getMyDice, {
				sessionId: bare.sessionId,
				participantId: bare.hostId,
			}),
		).resolves.toBeNull();
	});

	it("answers notInGame to outsiders and kicked players", async () => {
		const t = setup();
		const { host, sessionId, hostId, joinCode } = await newRoom(t);
		await expectCode(
			t.query(api.bluffDice.getMyDice, {
				sessionId,
				participantId: await outsider(t),
			}),
			"notInGame",
		);
		await expectCode(
			t.query(api.bluffDice.getMyDice, {
				sessionId,
				participantId: await deletedParticipantId(t, sessionId),
			}),
			"notInGame",
		);
		const kicked = await joinWithCode(t, joinCode, "guest_kicked");
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: kicked.participantId,
		});
		await expectCode(
			t.query(api.bluffDice.getMyDice, {
				sessionId,
				participantId: kicked.participantId,
			}),
			"notInGame",
		);
	});
});

describe("create", () => {
	it("returns a code a guest can type, and no link", async () => {
		const t = setup();
		const created = await signedInHost(t).mutation(
			api.bluffDice.create,
			HOSTED,
		);
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
		await expectCode(t.mutation(api.bluffDice.create, HOSTED), "signInToHost");
		expect(await sessionCount(t)).toBe(0);
	});
});
