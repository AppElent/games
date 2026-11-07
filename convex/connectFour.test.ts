import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import {
	advance,
	arrange,
	deletedSessionId,
	expectCode,
	fields,
	getDoc,
	hostSession,
	joinWithCode,
	joinWithToken,
	otherGameSession,
	type ParticipantId,
	type SessionId,
	setup,
	shareTokenOf,
	T0,
	type T,
	useFixedClock,
} from "./test.helpers";

useFixedClock();

const emptyBoard = () => new Array(42).fill("empty");

/** The client flow: challenge session, then its state, host seated red. */
async function newMatch(t: T) {
	const { host, sessionId, hostId } = await hostSession(
		t,
		"connect-four",
		"challenge",
	);
	await host.mutation(api.connectFour.createState, {
		sessionId,
		hostParticipantId: hostId,
	});
	return { host, sessionId, red: hostId };
}

async function fullMatch(t: T) {
	const match = await newMatch(t);
	const joined = await joinWithToken(
		t,
		await shareTokenOf(t, match.sessionId),
		"guest_yellow",
	);
	return { ...match, yellow: joined.participantId };
}

async function bundle(t: T, sessionId: SessionId) {
	const result = await t.query(api.connectFour.getBundle, { sessionId });
	if (!result?.state) {
		throw new Error("Expected a connect four bundle");
	}
	return { ...result, state: result.state };
}

function drop(
	t: T,
	sessionId: SessionId,
	participantId: ParticipantId,
	column: number,
) {
	return t.mutation(api.connectFour.drop, { sessionId, participantId, column });
}

/** Red stacks four in column 0 while yellow stacks in column 1. */
async function redWinsVertically(
	t: T,
	sessionId: SessionId,
	red: ParticipantId,
	yellow: ParticipantId,
) {
	for (let turn = 0; turn < 3; turn += 1) {
		await drop(t, sessionId, red, 0);
		await drop(t, sessionId, yellow, 1);
	}
	await drop(t, sessionId, red, 0);
}

describe("createState", () => {
	it("seats the host red on an empty board", async () => {
		const t = setup();
		const { sessionId, red } = await newMatch(t);
		const { state, session } = await bundle(t, sessionId);
		expect(fields(state)).toEqual({
			sessionId,
			phase: "waiting",
			redParticipantId: red,
			board: emptyBoard(),
			activeColor: "red",
			createdAt: T0,
			updatedAt: T0,
		});
		expect(state.board).toHaveLength(42);
		expect((await getDoc(t, red))?.seat).toBe("red");
		expect(session.status).toBe("lobby");
	});

	it("returns the existing state on a double submit", async () => {
		const t = setup();
		const { host, sessionId, red } = await newMatch(t);
		const { state } = await bundle(t, sessionId);
		await expect(
			host.mutation(api.connectFour.createState, {
				sessionId,
				hostParticipantId: red,
			}),
		).resolves.toBe(state._id);
	});

	it("answers sessionNotFound for another game's session or a missing one", async () => {
		const t = setup();
		const { hostId } = await hostSession(t, "connect-four", "challenge");
		for (const sessionId of [
			await otherGameSession(t),
			await deletedSessionId(t),
		]) {
			await expectCode(
				t.mutation(api.connectFour.createState, {
					sessionId,
					hostParticipantId: hostId,
				}),
				"sessionNotFound",
			);
		}
	});
});

describe("joining", () => {
	it("seats a link joiner yellow, leaving the phase alone", async () => {
		const t = setup();
		const { sessionId, red } = await newMatch(t);
		advance(500);
		const joined = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_two",
		);
		expect(joined).toEqual({
			sessionId,
			participantId: joined.participantId,
			gameType: "connect-four",
		});
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("waiting");
		expect(state.redParticipantId).toBe(red);
		expect(state.yellowParticipantId).toBe(joined.participantId);
		expect(state.updatedAt).toBe(T0 + 500);
		const row = await getDoc(t, joined.participantId);
		expect(row?.seat).toBe("yellow");
		expect(row?.role).toBe("player");
	});

	it("fills the red seat first when it is free", async () => {
		const t = setup();
		const { sessionId, red } = await newMatch(t);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, {
			redParticipantId: undefined,
			yellowParticipantId: red,
		});
		const joined = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_two",
		);
		expect((await getDoc(t, joined.participantId))?.seat).toBe("red");
		expect((await bundle(t, sessionId)).state.redParticipantId).toBe(
			joined.participantId,
		);
	});

	it("turns a third joiner into a watcher without a seat", async () => {
		const t = setup();
		const { sessionId } = await fullMatch(t);
		const third = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_third",
		);
		const row = await getDoc(t, third.participantId);
		expect(row?.role).toBe("watcher");
		expect(row?.seat).toBeUndefined();
	});

	it("gives a returning player their seat back", async () => {
		const t = setup();
		const { sessionId, yellow } = await fullMatch(t);
		const again = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_yellow",
		);
		expect(again.participantId).toBe(yellow);
		const row = await getDoc(t, yellow);
		expect(row?.seat).toBe("yellow");
		expect(row?.role).toBe("player");
	});

	it("leaves a spectator unseated, with the seat still free", async () => {
		const t = setup();
		const { sessionId } = await newMatch(t);
		const spectator = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
			{ asSpectator: true },
		);
		expect((await getDoc(t, spectator.participantId))?.role).toBe("watcher");
		expect(
			(await bundle(t, sessionId)).state.yellowParticipantId,
		).toBeUndefined();
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
		expect(row?.seat).toBe("yellow");
		expect(row?.role).toBe("watcher");
	});

	it("pins that a room-code join never seats the joiner", async () => {
		const t = setup();
		const { host, sessionId, hostId, joinCode } = await hostSession(
			t,
			"connect-four",
			"room",
		);
		await host.mutation(api.connectFour.createState, {
			sessionId,
			hostParticipantId: hostId,
		});
		const joined = await joinWithCode(t, joinCode as string, "guest_code");
		const row = await getDoc(t, joined.participantId);
		expect(row?.role).toBe("player");
		expect(row?.seat).toBeUndefined();
		expect(
			(await bundle(t, sessionId)).state.yellowParticipantId,
		).toBeUndefined();
	});
});

describe("drop", () => {
	it("lands the first disc on the bottom row and activates the session", async () => {
		const t = setup();
		const { sessionId, red } = await fullMatch(t);
		advance(1000);
		await drop(t, sessionId, red, 3);
		const { state, session } = await bundle(t, sessionId);
		const expected = emptyBoard();
		expected[5 * 7 + 3] = "red";
		expect(state.board).toEqual(expected);
		expect(state.phase).toBe("active");
		expect(state.activeColor).toBe("yellow");
		expect(state.updatedAt).toBe(T0 + 1000);
		expect(session.status).toBe("active");
		expect(session.startedAt).toBe(T0 + 1000);
	});

	it("stacks discs and keeps the first startedAt", async () => {
		const t = setup();
		const { sessionId, red, yellow } = await fullMatch(t);
		await drop(t, sessionId, red, 3);
		advance(1000);
		await drop(t, sessionId, yellow, 3);
		const { state, session } = await bundle(t, sessionId);
		expect(state.board[5 * 7 + 3]).toBe("red");
		expect(state.board[4 * 7 + 3]).toBe("yellow");
		expect(state.activeColor).toBe("red");
		expect(session.startedAt).toBe(T0);
	});

	it("waits for an opponent", async () => {
		const t = setup();
		const { sessionId, red } = await newMatch(t);
		await expectCode(drop(t, sessionId, red, 0), "waitingForOpponent");
	});

	it("answers notSeated to a watcher and notYourTurn to the other seat", async () => {
		const t = setup();
		const { sessionId, yellow } = await fullMatch(t);
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
		);
		await expectCode(drop(t, sessionId, watcher.participantId, 0), "notSeated");
		await expectCode(drop(t, sessionId, yellow, 0), "notYourTurn");
	});

	it("answers invalidColumn off the board and columnFull on a full stack", async () => {
		const t = setup();
		const { sessionId, red, yellow } = await fullMatch(t);
		for (const column of [-1, 7, 1.5]) {
			await expectCode(drop(t, sessionId, red, column), "invalidColumn");
		}
		for (let turn = 0; turn < 3; turn += 1) {
			await drop(t, sessionId, red, 0);
			await drop(t, sessionId, yellow, 0);
		}
		await expectCode(drop(t, sessionId, red, 0), "columnFull");
		expect((await bundle(t, sessionId)).state.activeColor).toBe("red");
	});

	it("answers gameNotFound for another game, a missing session, or no state", async () => {
		const t = setup();
		const { sessionId: noState, hostId } = await hostSession(
			t,
			"connect-four",
			"challenge",
		);
		for (const sessionId of [
			await otherGameSession(t),
			await deletedSessionId(t),
			noState,
		]) {
			await expectCode(drop(t, sessionId, hostId, 0), "gameNotFound");
		}
	});

	it("finishes on four in a row", async () => {
		const t = setup();
		const { sessionId, red, yellow } = await fullMatch(t);
		advance(1000);
		await redWinsVertically(t, sessionId, red, yellow);
		const { state, session } = await bundle(t, sessionId);
		expect(state.phase).toBe("finished");
		expect(state.resultOutcome).toBe("connect");
		expect(state.resultWinner).toBe("red");
		expect(state.winnerParticipantId).toBe(red);
		expect(state.activeColor).toBe("yellow");
		expect(session.status).toBe("completed");
		expect(session.endedAt).toBe(T0 + 1000);
		expect(session.completedReason).toBe("finished");
		expect(session.participantCount).toBe(2);
		expect(session.winnerParticipantIds).toEqual([red]);
		await expectCode(drop(t, sessionId, yellow, 2), "gameAlreadyFinished");
	});

	it("draws on a full board with no winner", async () => {
		const t = setup();
		const { sessionId, red } = await fullMatch(t);
		const { state } = await bundle(t, sessionId);
		const R = "red" as const;
		const Y = "yellow" as const;
		await arrange(t, state._id, {
			phase: "active",
			board: [
				// biome-ignore format: the board reads as rows
				"empty", R, Y, R, Y, R, Y,
				Y, Y, R, Y, Y, R, R,
				Y, Y, Y, R, R, Y, R,
				Y, R, Y, R, Y, R, R,
				R, Y, Y, R, R, Y, Y,
				R, Y, R, Y, R, R, Y,
			],
		});
		await drop(t, sessionId, red, 0);
		const after = await bundle(t, sessionId);
		expect(after.state.phase).toBe("finished");
		expect(after.state.resultOutcome).toBe("draw");
		expect(after.state.resultWinner).toBeUndefined();
		expect(after.state.winnerParticipantId).toBeUndefined();
		expect(after.session.status).toBe("completed");
		expect(after.session.winnerParticipantIds).toEqual([]);
	});
});

describe("resign", () => {
	it("hands the win to the other seat", async () => {
		const t = setup();
		const { sessionId, red, yellow } = await fullMatch(t);
		advance(1000);
		await t.mutation(api.connectFour.resign, {
			sessionId,
			participantId: yellow,
		});
		const { state, session } = await bundle(t, sessionId);
		expect(state.phase).toBe("finished");
		expect(state.resultOutcome).toBe("resignation");
		expect(state.resultWinner).toBe("red");
		expect(state.winnerParticipantId).toBe(red);
		expect(session.status).toBe("completed");
		expect(session.endedAt).toBe(T0 + 1000);
		expect(session.winnerParticipantIds).toEqual([red]);
	});

	it("pins that a host can resign with nobody seated opposite", async () => {
		const t = setup();
		const { sessionId, red } = await newMatch(t);
		await t.mutation(api.connectFour.resign, { sessionId, participantId: red });
		const { state, session } = await bundle(t, sessionId);
		expect(state.resultWinner).toBe("yellow");
		expect(state.winnerParticipantId).toBeUndefined();
		expect(session.status).toBe("completed");
		expect(session.winnerParticipantIds).toEqual([]);
	});

	it("answers notSeated and gameAlreadyFinished", async () => {
		const t = setup();
		const { sessionId, red } = await fullMatch(t);
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
		);
		await expectCode(
			t.mutation(api.connectFour.resign, {
				sessionId,
				participantId: watcher.participantId,
			}),
			"notSeated",
		);
		await t.mutation(api.connectFour.resign, { sessionId, participantId: red });
		await expectCode(
			t.mutation(api.connectFour.resign, { sessionId, participantId: red }),
			"gameAlreadyFinished",
		);
	});
});

describe("rematch", () => {
	it("swaps colours, starts active at once, and reopens the session", async () => {
		const t = setup();
		const { sessionId, red, yellow } = await fullMatch(t);
		await redWinsVertically(t, sessionId, red, yellow);
		const finished = await bundle(t, sessionId);
		advance(5000);
		await t.mutation(api.connectFour.rematch, {
			sessionId,
			participantId: yellow,
		});
		const { state, session } = await bundle(t, sessionId);
		expect(fields(state)).toEqual({
			sessionId,
			phase: "active",
			redParticipantId: yellow,
			yellowParticipantId: red,
			board: emptyBoard(),
			activeColor: "red",
			createdAt: T0,
			updatedAt: T0 + 5000,
		});
		expect((await getDoc(t, yellow))?.seat).toBe("red");
		expect((await getDoc(t, red))?.seat).toBe("yellow");
		expect(session.status).toBe("active");
		expect(session.endedAt).toBeUndefined();
		expect(session.completedReason).toBeUndefined();
		expect(session.winnerParticipantIds).toBeUndefined();
		expect(session.startedAt).toBe(finished.session.startedAt);
		await expectCode(drop(t, sessionId, red, 0), "notYourTurn");
		await drop(t, sessionId, yellow, 0);
	});

	it("answers currentGameNotFinished during play", async () => {
		const t = setup();
		const { sessionId, red } = await fullMatch(t);
		await expectCode(
			t.mutation(api.connectFour.rematch, { sessionId, participantId: red }),
			"currentGameNotFinished",
		);
	});

	it("answers notSeated to a watcher", async () => {
		const t = setup();
		const { sessionId, red } = await fullMatch(t);
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
		);
		await t.mutation(api.connectFour.resign, { sessionId, participantId: red });
		await expectCode(
			t.mutation(api.connectFour.rematch, {
				sessionId,
				participantId: watcher.participantId,
			}),
			"notSeated",
		);
	});
});

describe("getBundle", () => {
	it("returns session, participants, and state", async () => {
		const t = setup();
		const { sessionId, red, yellow } = await fullMatch(t);
		const result = await t.query(api.connectFour.getBundle, { sessionId });
		expect(Object.keys(result ?? {}).sort()).toEqual([
			"participants",
			"session",
			"state",
		]);
		expect(result?.participants.map((row) => row._id)).toEqual([red, yellow]);
	});

	it("is null for a missing session, and state is null ahead of createState", async () => {
		const t = setup();
		await expect(
			t.query(api.connectFour.getBundle, {
				sessionId: await deletedSessionId(t),
			}),
		).resolves.toBeNull();
		const { sessionId } = await hostSession(t, "connect-four", "challenge");
		expect(
			(await t.query(api.connectFour.getBundle, { sessionId }))?.state,
		).toBeNull();
	});
});
