import { createInitialBackgammonState } from "@arcadeclub/core/backgammon";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import {
	advance,
	alternateRandom,
	arrange,
	createdRows,
	deletedSessionId,
	expectCode,
	fields,
	fixRandom,
	getDoc,
	HOST_USER,
	HOSTED,
	hostSession,
	joinWithCode,
	joinWithToken,
	otherGameSession,
	type ParticipantId,
	sessionCount,
	type SessionId,
	setup,
	shareTokenOf,
	signedInHost,
	type T,
	T0,
	useFixedClock,
} from "./test.helpers";

useFixedClock();

const DIE_ONE = 0;
const DIE_FOUR = 0.5;

/** The client flow: challenge session, then its state, host seated white. */
async function newMatch(t: T) {
	const { host, sessionId, hostId } = await hostSession(
		t,
		"backgammon",
		"challenge",
	);
	await host.mutation(api.backgammon.createState, {
		sessionId,
		hostParticipantId: hostId,
	});
	return { host, sessionId, white: hostId };
}

async function fullMatch(t: T) {
	const match = await newMatch(t);
	const joined = await joinWithToken(
		t,
		await shareTokenOf(t, match.sessionId),
		"guest_black",
	);
	return { ...match, black: joined.participantId };
}

async function bundle(t: T, sessionId: SessionId) {
	const result = await t.query(api.backgammon.getBundle, { sessionId });
	if (!result?.state) {
		throw new Error("Expected a backgammon bundle");
	}
	return { ...result, state: result.state };
}

async function roll(t: T, sessionId: SessionId, participantId: ParticipantId) {
	return await t.mutation(api.backgammon.rollDice, { sessionId, participantId });
}

/** One white checker left, one die of 1 to bear it off. */
async function arrangeWhiteOneMoveFromWinning(t: T, sessionId: SessionId) {
	const { state } = await bundle(t, sessionId);
	await arrange(t, state._id, {
		phase: "active",
		points: state.points.map((point) =>
			point.point === 1
				? { point: 1, color: "white" as const, count: 1 }
				: { point: point.point, count: 0 },
		),
		off: { white: 14, black: 0 },
		bar: { white: 0, black: 0 },
		dice: [1, 2],
		usedDice: [],
		activeColor: "white",
	});
}

async function finishedMatch(t: T) {
	const match = await fullMatch(t);
	await arrangeWhiteOneMoveFromWinning(t, match.sessionId);
	await t.mutation(api.backgammon.applyMove, {
		sessionId: match.sessionId,
		participantId: match.white,
		from: 1,
		to: "off",
	});
	return match;
}

describe("createState", () => {
	it("seats the host white on the opening board, waiting for an opponent", async () => {
		const t = setup();
		const { sessionId, white } = await newMatch(t);
		const opening = createInitialBackgammonState();
		const result = await bundle(t, sessionId);
		expect(fields(result.state)).toEqual({
			sessionId,
			phase: "waiting",
			whiteParticipantId: white,
			activeColor: "white",
			points: opening.points,
			bar: { white: 0, black: 0 },
			off: { white: 0, black: 0 },
			dice: [],
			usedDice: [],
			createdAt: T0,
			updatedAt: T0,
		});
		expect((await getDoc(t, white))?.seat).toBe("white");
		expect(result.session.status).toBe("lobby");
		expect(result.moves).toEqual([]);
	});

	it("returns the existing state on a double submit and leaves it alone", async () => {
		const t = setup();
		const { host, sessionId, white } = await newMatch(t);
		const { state } = await bundle(t, sessionId);
		advance(1000);
		await expect(
			host.mutation(api.backgammon.createState, {
				sessionId,
				hostParticipantId: white,
			}),
		).resolves.toBe(state._id);
		expect((await bundle(t, sessionId)).state.updatedAt).toBe(T0);
	});

	it("answers sessionNotFound for another game's session or a missing one", async () => {
		const t = setup();
		const { hostId } = await hostSession(t, "backgammon", "challenge");
		await expectCode(
			t.mutation(api.backgammon.createState, {
				sessionId: await otherGameSession(t),
				hostParticipantId: hostId,
			}),
			"sessionNotFound",
		);
		await expectCode(
			t.mutation(api.backgammon.createState, {
				sessionId: await deletedSessionId(t),
				hostParticipantId: hostId,
			}),
			"sessionNotFound",
		);
	});
});

describe("joining", () => {
	it("seats a link joiner black and makes the table ready", async () => {
		const t = setup();
		const { sessionId, white } = await newMatch(t);
		advance(500);
		const joined = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_black",
		);
		expect(joined).toEqual({
			sessionId,
			participantId: joined.participantId,
			gameType: "backgammon",
		});
		const result = await bundle(t, sessionId);
		expect(result.state.phase).toBe("ready");
		expect(result.state.whiteParticipantId).toBe(white);
		expect(result.state.blackParticipantId).toBe(joined.participantId);
		expect(result.state.updatedAt).toBe(T0 + 500);
		expect(fields(await getDoc(t, joined.participantId))).toEqual({
			sessionId,
			guestId: "guest_black",
			displayName: "guest_black",
			role: "player",
			seat: "black",
			connected: true,
			lastSeen: T0 + 500,
		});
	});

	it("turns a third joiner into a watcher without a seat", async () => {
		const t = setup();
		const { sessionId, black } = await fullMatch(t);
		const third = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_third",
		);
		const row = await getDoc(t, third.participantId);
		expect(row?.role).toBe("watcher");
		expect(row?.seat).toBeUndefined();
		expect((await bundle(t, sessionId)).state.blackParticipantId).toBe(black);
	});

	it("gives returning players their own seat back", async () => {
		const t = setup();
		const { host, sessionId, white, black } = await fullMatch(t);
		const token = await shareTokenOf(t, sessionId);
		const again = await joinWithToken(t, token, "guest_black");
		expect(again.participantId).toBe(black);
		const hostAgain = await host.mutation(api.sessions.joinByToken, {
			shareToken: token,
			displayName: "Host",
		});
		expect(hostAgain.participantId).toBe(white);
		expect((await getDoc(t, white))?.seat).toBe("white");
		expect((await getDoc(t, black))?.seat).toBe("black");
		expect((await bundle(t, sessionId)).participants).toHaveLength(2);
	});

	it("leaves a spectator unseated, with the black seat still free", async () => {
		const t = setup();
		const { sessionId } = await newMatch(t);
		const spectator = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
			{ asSpectator: true },
		);
		const row = await getDoc(t, spectator.participantId);
		expect(row?.role).toBe("watcher");
		expect(row?.seat).toBeUndefined();
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("waiting");
		expect(state.blackParticipantId).toBeUndefined();
	});

	it("pins that a returning watcher takes the seat but keeps the watcher role", async () => {
		const t = setup();
		const { sessionId } = await newMatch(t);
		const token = await shareTokenOf(t, sessionId);
		const first = await joinWithToken(t, token, "guest_watch", {
			asSpectator: true,
		});
		await joinWithToken(t, token, "guest_watch");
		const row = await getDoc(t, first.participantId);
		expect(row?.seat).toBe("black");
		expect(row?.role).toBe("watcher");
		expect((await bundle(t, sessionId)).state.blackParticipantId).toBe(
			first.participantId,
		);
	});

	it("pins that a room-code join never seats the joiner", async () => {
		const t = setup();
		const { host, sessionId, hostId, joinCode } = await hostSession(
			t,
			"backgammon",
			"room",
		);
		await host.mutation(api.backgammon.createState, {
			sessionId,
			hostParticipantId: hostId,
		});
		const joined = await joinWithCode(t, joinCode as string, "guest_code");
		expect(joined.seatClaimed).toBe(false);
		const row = await getDoc(t, joined.participantId);
		expect(row?.role).toBe("player");
		expect(row?.seat).toBeUndefined();
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("waiting");
		expect(state.blackParticipantId).toBeUndefined();
	});

	it("pins that a joiner ahead of createState stays an unseated player", async () => {
		const t = setup();
		const { sessionId } = await hostSession(t, "backgammon", "challenge");
		const joined = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_early",
		);
		const row = await getDoc(t, joined.participantId);
		expect(row?.role).toBe("player");
		expect(row?.seat).toBeUndefined();
	});
});

describe("rollDice", () => {
	it("rolls doubles as four dice, activates the session, and logs the roll", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		fixRandom(DIE_FOUR);
		advance(1000);
		await expect(roll(t, sessionId, white)).resolves.toEqual([4, 4, 4, 4]);
		const result = await bundle(t, sessionId);
		expect(result.state.phase).toBe("active");
		expect(result.state.dice).toEqual([4, 4, 4, 4]);
		expect(result.state.usedDice).toEqual([]);
		expect(result.session.status).toBe("active");
		expect(result.session.startedAt).toBe(T0 + 1000);
		expect(result.moves.map(fields)).toEqual([
			{
				sessionId,
				participantId: white,
				moveType: "roll",
				color: "white",
				dice: [4, 4, 4, 4],
				createdAt: T0 + 1000,
			},
		]);
	});

	it("rolls two dice when they differ", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		alternateRandom(0, 0.99);
		const dice = await roll(t, sessionId, white);
		expect([...dice].sort()).toEqual([1, 6]);
		expect((await bundle(t, sessionId)).state.dice).toEqual(dice);
	});

	it("keeps the first startedAt on later rolls", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t);
		fixRandom(DIE_ONE);
		await roll(t, sessionId, white);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, {
			activeColor: "black",
			dice: [],
			usedDice: [],
		});
		advance(5000);
		await roll(t, sessionId, black);
		expect((await bundle(t, sessionId)).session.startedAt).toBe(T0);
	});

	it("refuses a second roll", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		await roll(t, sessionId, white);
		await expectCode(roll(t, sessionId, white), "endTurnBeforeRolling");
	});

	it("waits for both players", async () => {
		const t = setup();
		const { sessionId, white } = await newMatch(t);
		await expectCode(roll(t, sessionId, white), "waitingForBothPlayers");
	});

	it("answers notYourTurn to the opponent and to anyone unseated", async () => {
		const t = setup();
		const { sessionId, black } = await fullMatch(t);
		await expectCode(roll(t, sessionId, black), "notYourTurn");
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
		);
		await expectCode(roll(t, sessionId, watcher.participantId), "notYourTurn");
	});

	it("answers gameNotFound for another game, a missing session, or no state", async () => {
		const t = setup();
		const { sessionId: noState, hostId } = await hostSession(
			t,
			"backgammon",
			"challenge",
		);
		for (const sessionId of [
			await otherGameSession(t),
			await deletedSessionId(t),
			noState,
		]) {
			await expectCode(roll(t, sessionId, hostId), "gameNotFound");
		}
	});
});

describe("applyMove", () => {
	async function rolled(t: T) {
		const match = await fullMatch(t);
		fixRandom(DIE_ONE);
		await roll(t, match.sessionId, match.white);
		return match;
	}

	it("moves a checker, spends the die, and logs the move", async () => {
		const t = setup();
		const { sessionId, white } = await rolled(t);
		advance(1000);
		await t.mutation(api.backgammon.applyMove, {
			sessionId,
			participantId: white,
			from: 6,
			to: 5,
		});
		const { state, moves } = await bundle(t, sessionId);
		expect(state.points[5]).toEqual({ point: 6, color: "white", count: 4 });
		expect(state.points[4]).toEqual({ point: 5, color: "white", count: 1 });
		expect(state.usedDice).toEqual([1]);
		expect(state.dice).toEqual([1, 1, 1, 1]);
		expect(state.updatedAt).toBe(T0 + 1000);
		expect(fields(moves[1])).toEqual({
			sessionId,
			participantId: white,
			moveType: "move",
			color: "white",
			from: 6,
			to: 5,
			dice: [1],
			createdAt: T0 + 1000,
		});
	});

	it("hits a lone opposing checker onto the bar", async () => {
		const t = setup();
		const { sessionId, white } = await rolled(t);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, {
			points: state.points.map((point) =>
				point.point === 5
					? { point: 5, color: "black" as const, count: 1 }
					: point,
			),
		});
		await t.mutation(api.backgammon.applyMove, {
			sessionId,
			participantId: white,
			from: 6,
			to: 5,
		});
		const after = await bundle(t, sessionId);
		expect(after.state.bar).toEqual({ white: 0, black: 1 });
		expect(after.state.points[4]).toEqual({
			point: 5,
			color: "white",
			count: 1,
		});
	});

	it("answers rollBeforeMoving ahead of the roll", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		await expectCode(
			t.mutation(api.backgammon.applyMove, {
				sessionId,
				participantId: white,
				from: 6,
				to: 5,
			}),
			"rollBeforeMoving",
		);
	});

	it("answers rollBeforeMoving once every die is spent", async () => {
		const t = setup();
		const { sessionId, white } = await rolled(t);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, { usedDice: [1, 1, 1, 1] });
		await expectCode(
			t.mutation(api.backgammon.applyMove, {
				sessionId,
				participantId: white,
				from: 6,
				to: 5,
			}),
			"rollBeforeMoving",
		);
	});

	it("answers choosePointWithChecker for empty, opposing, and off-board points", async () => {
		const t = setup();
		const { sessionId, white } = await rolled(t);
		for (const from of [2, 1, 99]) {
			await expectCode(
				t.mutation(api.backgammon.applyMove, {
					sessionId,
					participantId: white,
					from,
					to: from - 1,
				}),
				"choosePointWithChecker",
			);
		}
		await expectCode(
			t.mutation(api.backgammon.applyMove, {
				sessionId,
				participantId: white,
				from: "bar",
				to: 24,
			}),
			"choosePointWithChecker",
		);
	});

	it("answers invalidDestination for a move the dice do not allow", async () => {
		const t = setup();
		const { sessionId, white } = await rolled(t);
		await expectCode(
			t.mutation(api.backgammon.applyMove, {
				sessionId,
				participantId: white,
				from: 6,
				to: 3,
			}),
			"invalidDestination",
		);
		await expectCode(
			t.mutation(api.backgammon.applyMove, {
				sessionId,
				participantId: white,
				from: 6,
				to: "off",
			}),
			"invalidDestination",
		);
	});

	it("makes a checker on the bar re-enter first", async () => {
		const t = setup();
		const { sessionId, white } = await rolled(t);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, { bar: { white: 1, black: 0 } });
		await expectCode(
			t.mutation(api.backgammon.applyMove, {
				sessionId,
				participantId: white,
				from: 6,
				to: 5,
			}),
			"enterFromBarFirst",
		);
		await t.mutation(api.backgammon.applyMove, {
			sessionId,
			participantId: white,
			from: "bar",
			to: 24,
		});
		const after = await bundle(t, sessionId);
		expect(after.state.bar.white).toBe(0);
		expect(after.state.points[23]).toEqual({
			point: 24,
			color: "white",
			count: 3,
		});
	});

	it("applies the same seat guards as a roll", async () => {
		const t = setup();
		const { sessionId, black } = await rolled(t);
		await expectCode(
			t.mutation(api.backgammon.applyMove, {
				sessionId,
				participantId: black,
				from: 12,
				to: 13,
			}),
			"notYourTurn",
		);
		const waiting = await newMatch(t);
		await expectCode(
			t.mutation(api.backgammon.applyMove, {
				sessionId: waiting.sessionId,
				participantId: waiting.white,
				from: 6,
				to: 5,
			}),
			"waitingForBothPlayers",
		);
	});

	it("finishes the game on the fifteenth checker off", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		await arrangeWhiteOneMoveFromWinning(t, sessionId);
		advance(2000);
		await t.mutation(api.backgammon.applyMove, {
			sessionId,
			participantId: white,
			from: 1,
			to: "off",
		});
		const { state, session, moves } = await bundle(t, sessionId);
		expect(state.phase).toBe("finished");
		expect(state.winnerParticipantId).toBe(white);
		expect(state.off).toEqual({ white: 15, black: 0 });
		expect(state.activeColor).toBe("white");
		expect(session.status).toBe("completed");
		expect(session.endedAt).toBe(T0 + 2000);
		expect(session.completedReason).toBe("finished");
		expect(session.participantCount).toBe(2);
		expect(session.winnerParticipantIds).toEqual([white]);
		expect(moves.at(-1)?.moveType).toBe("move");
		expect(moves.at(-1)?.to).toBe("off");
	});

	it("refuses play after the finish", async () => {
		const t = setup();
		const { sessionId, white } = await finishedMatch(t);
		await expectCode(roll(t, sessionId, white), "gameAlreadyFinished");
		await expectCode(
			t.mutation(api.backgammon.applyMove, {
				sessionId,
				participantId: white,
				from: 1,
				to: "off",
			}),
			"gameAlreadyFinished",
		);
		await expectCode(
			t.mutation(api.backgammon.endTurn, { sessionId, participantId: white }),
			"gameAlreadyFinished",
		);
	});
});

describe("endTurn", () => {
	it("answers rollBeforeEndingTurn ahead of the roll", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		await expectCode(
			t.mutation(api.backgammon.endTurn, { sessionId, participantId: white }),
			"rollBeforeEndingTurn",
		);
	});

	it("answers movesRemaining while a die can still be played", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		fixRandom(DIE_ONE);
		await roll(t, sessionId, white);
		await expectCode(
			t.mutation(api.backgammon.endTurn, { sessionId, participantId: white }),
			"movesRemaining",
		);
	});

	it("hands over once the dice are spent, and logs it", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t);
		fixRandom(DIE_ONE);
		await roll(t, sessionId, white);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, { usedDice: [1, 1, 1, 1] });
		advance(3000);
		await t.mutation(api.backgammon.endTurn, {
			sessionId,
			participantId: white,
		});
		const after = await bundle(t, sessionId);
		expect(after.state.activeColor).toBe("black");
		expect(after.state.dice).toEqual([]);
		expect(after.state.usedDice).toEqual([]);
		expect(fields(after.moves.at(-1))).toEqual({
			sessionId,
			participantId: white,
			moveType: "endTurn",
			color: "white",
			dice: [],
			createdAt: T0 + 3000,
		});
		await expect(roll(t, sessionId, black)).resolves.toEqual([1, 1, 1, 1]);
	});

	it("hands over when no remaining die can be played", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, {
			phase: "active",
			dice: [6, 6, 6, 6],
			points: state.points.map((point) =>
				point.point === 7
					? { point: 7, color: "white" as const, count: 15 }
					: point.point === 1
						? { point: 1, color: "black" as const, count: 15 }
						: { point: point.point, count: 0 },
			),
		});
		await t.mutation(api.backgammon.endTurn, {
			sessionId,
			participantId: white,
		});
		expect((await bundle(t, sessionId)).state.activeColor).toBe("black");
	});
});

describe("rematch", () => {
	it("swaps colours, resets the board, and reopens the session", async () => {
		const t = setup();
		const { sessionId, white, black } = await finishedMatch(t);
		const before = await bundle(t, sessionId);
		advance(9000);
		await t.mutation(api.backgammon.rematch, {
			sessionId,
			participantId: black,
		});
		const { state, session, moves } = await bundle(t, sessionId);
		const opening = createInitialBackgammonState();
		expect(fields(state)).toEqual({
			sessionId,
			phase: "ready",
			whiteParticipantId: black,
			blackParticipantId: white,
			activeColor: "white",
			points: opening.points,
			bar: { white: 0, black: 0 },
			off: { white: 0, black: 0 },
			dice: [],
			usedDice: [],
			createdAt: T0,
			updatedAt: T0 + 9000,
		});
		expect((await getDoc(t, black))?.seat).toBe("white");
		expect((await getDoc(t, white))?.seat).toBe("black");
		expect(session.status).toBe("active");
		expect(session.endedAt).toBeUndefined();
		expect(session.completedReason).toBeUndefined();
		expect(session.winnerParticipantIds).toBeUndefined();
		expect(session.startedAt).toBe(before.session.startedAt);
		expect(session.participantCount).toBe(2);
		expect(moves).toHaveLength(before.moves.length);
	});

	it("lets the new white player roll first", async () => {
		const t = setup();
		const { sessionId, white, black } = await finishedMatch(t);
		await t.mutation(api.backgammon.rematch, {
			sessionId,
			participantId: white,
		});
		await expectCode(roll(t, sessionId, white), "notYourTurn");
		fixRandom(DIE_ONE);
		await roll(t, sessionId, black);
		expect((await bundle(t, sessionId)).state.phase).toBe("active");
	});

	it("answers currentGameNotFinished during play", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		await expectCode(
			t.mutation(api.backgammon.rematch, { sessionId, participantId: white }),
			"currentGameNotFinished",
		);
	});

	it("answers playersOnlyRematch to a watcher", async () => {
		const t = setup();
		const { sessionId } = await fullMatch(t);
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
		);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, { phase: "finished" });
		await expectCode(
			t.mutation(api.backgammon.rematch, {
				sessionId,
				participantId: watcher.participantId,
			}),
			"playersOnlyRematch",
		);
	});

	it("turns a late joiner away from a finished game", async () => {
		const t = setup();
		const { sessionId } = await finishedMatch(t);
		await expectCode(
			joinWithToken(t, await shareTokenOf(t, sessionId), "guest_late"),
			"gameUnavailable",
		);
	});
});

describe("getBundle", () => {
	it("returns session, participants, state, and moves", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t);
		const result = await t.query(api.backgammon.getBundle, { sessionId });
		expect(Object.keys(result ?? {}).sort()).toEqual([
			"moves",
			"participants",
			"session",
			"state",
		]);
		expect(result?.participants.map((row) => row._id)).toEqual([white, black]);
		expect(fields(result?.session)).toEqual({
			gameType: "backgammon",
			status: "lobby",
			joinMode: "challenge",
			authPolicy: "guestAllowed",
			title: "Game",
			hostUserId: HOST_USER,
			hostParticipantId: white,
			shareToken: expect.stringMatching(/^share_[0-9a-f]{32}$/),
		});
	});

	it("is null for a missing session, and state is null ahead of createState", async () => {
		const t = setup();
		await expect(
			t.query(api.backgammon.getBundle, {
				sessionId: await deletedSessionId(t),
			}),
		).resolves.toBeNull();
		const { sessionId } = await hostSession(t, "backgammon", "challenge");
		const result = await t.query(api.backgammon.getBundle, { sessionId });
		expect(result?.state).toBeNull();
		expect(result?.moves).toEqual([]);
	});
});

describe("create", () => {
	it("stores what sessions.create and createState store together", async () => {
		const t = setup();
		const twoStep = await newMatch(t);
		const created = await signedInHost(t).mutation(api.backgammon.create, HOSTED);
		expect(await createdRows(t, created.sessionId, "backgammonGameStates")).toEqual(
			await createdRows(t, twoStep.sessionId, "backgammonGameStates"),
		);
	});

	it("returns a link a guest can follow, and no room code", async () => {
		const t = setup();
		const created = await signedInHost(t).mutation(api.backgammon.create, HOSTED);
		expect(created.joinCode).toBeUndefined();
		expect(created.shareToken).toBe(await shareTokenOf(t, created.sessionId));
		const joined = await joinWithToken(
			t,
			created.shareToken as string,
			"guest_two",
		);
		expect(joined.sessionId).toBe(created.sessionId);
	});

	it("needs an account to host, and leaves nothing behind without one", async () => {
		const t = setup();
		await expectCode(t.mutation(api.backgammon.create, HOSTED), "signInToHost");
		expect(await sessionCount(t)).toBe(0);
	});
});
