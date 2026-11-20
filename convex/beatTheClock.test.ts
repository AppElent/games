import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import {
	advance,
	expectCode,
	freezeClock,
	guestIdOf,
	HOSTED,
	impostor,
	joinWithCode,
	type ParticipantId,
	type SessionId,
	setup,
	signedInHost,
	type T,
} from "./test.helpers";

freezeClock();

const SETTINGS = {
	packId: "everyday",
	locale: "en",
	turnSeconds: 30,
	target: 20,
	teamCount: 2,
};

async function newRoom(t: T) {
	const host = signedInHost(t);
	const created = await host.mutation(api.beatTheClock.create, {
		...HOSTED,
		...SETTINGS,
	});
	return {
		sessionId: created.sessionId,
		hostId: created.participantId,
		joinCode: created.joinCode as string,
	};
}

function seat(sessionId: SessionId, participantId: ParticipantId) {
	return { sessionId, participantId };
}

/** Host (Comets) and three guests: Comets host + noor, Rockets daan + mila. */
async function startedRoom(t: T) {
	const room = await newRoom(t);
	const join = async (name: string) =>
		(await joinWithCode(t, room.joinCode, name)).participantId;
	const noor = await join(guestIdOf("noor"));
	const daan = await join(guestIdOf("daan"));
	const mila = await join(guestIdOf("mila"));
	const s = (id: ParticipantId) => seat(room.sessionId, id);
	await t.mutation(api.beatTheClock.pickTeam, { ...s(room.hostId), team: 0 });
	await t.mutation(api.beatTheClock.pickTeam, { ...s(noor), team: 0 });
	await t.mutation(api.beatTheClock.pickTeam, { ...s(daan), team: 1 });
	await t.mutation(api.beatTheClock.pickTeam, { ...s(mila), team: 1 });
	await t.mutation(api.beatTheClock.start, s(room.hostId));
	return { ...room, noor, daan, mila, s };
}

async function stateOf(t: T, sessionId: SessionId) {
	return await t.run(async (ctx) => {
		const row = await ctx.db
			.query("beatTheClockStates")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.unique();
		if (!row) throw new Error("no state");
		return row;
	});
}

async function viewAs(
	t: T,
	sessionId: SessionId,
	participantId?: ParticipantId,
) {
	const bundle = await t.query(api.beatTheClock.getBundle, {
		sessionId,
		participantId,
	});
	if (!bundle) throw new Error("no bundle");
	return bundle;
}

describe("beatTheClock.create", () => {
	it("opens a room with a code and a lobby", async () => {
		const t = setup();
		const room = await newRoom(t);
		expect(room.joinCode).toHaveLength(6);
		const state = await stateOf(t, room.sessionId);
		expect(state.phase).toBe("lobby");
		expect(state.scores).toEqual([0, 0]);
	});

	it("refuses settings and packs off the menu", async () => {
		const t = setup();
		const host = signedInHost(t);
		await expectCode(
			host.mutation(api.beatTheClock.create, {
				...HOSTED,
				...SETTINGS,
				turnSeconds: 5,
			}),
			"clockBadSettings",
		);
		await expectCode(
			host.mutation(api.beatTheClock.create, {
				...HOSTED,
				...SETTINGS,
				packId: "nope",
			}),
			"clockBadPack",
		);
	});
});

describe("a game", () => {
	it("starts only with two players per team, and only by the host", async () => {
		const t = setup();
		const room = await newRoom(t);
		const noor = (await joinWithCode(t, room.joinCode, guestIdOf("noor")))
			.participantId;
		await expectCode(
			t.mutation(api.beatTheClock.start, seat(room.sessionId, noor)),
			"hostOnly",
		);
		await expectCode(
			t.mutation(api.beatTheClock.start, seat(room.sessionId, room.hostId)),
			"clockTeamsNeedTwo",
		);
	});

	it("keeps the words from the guessing team while the clock runs", async () => {
		const t = setup();
		const room = await startedRoom(t);
		const ready = await viewAs(t, room.sessionId, room.hostId);
		expect(ready.state.phase).toBe("ready");
		expect(ready.words).toBeNull();
		expect(JSON.stringify(ready.state)).not.toContain('deck"');

		await t.mutation(api.beatTheClock.goTurn, room.s(room.hostId));
		expect((await viewAs(t, room.sessionId, room.hostId)).words).toHaveLength(
			5,
		);
		expect((await viewAs(t, room.sessionId, room.daan)).words).toHaveLength(5);
		expect((await viewAs(t, room.sessionId, room.noor)).words).toBeNull();
		expect((await viewAs(t, room.sessionId)).words).toBeNull();
		// Naming the describer's seat without its proof shows nothing.
		const spoofed = await impostor(t).query(api.beatTheClock.getBundle, {
			sessionId: room.sessionId,
			participantId: room.hostId,
		});
		expect(spoofed?.words).toBeNull();
	});

	it("plays a turn: ticks, send, flag, confirm, score", async () => {
		const t = setup();
		const room = await startedRoom(t);
		await t.mutation(api.beatTheClock.goTurn, room.s(room.hostId));
		for (const index of [0, 1, 2]) {
			await t.mutation(api.beatTheClock.tick, {
				...room.s(room.hostId),
				index,
				guessed: true,
			});
		}
		await expectCode(
			t.mutation(api.beatTheClock.tick, {
				...room.s(room.noor),
				index: 3,
				guessed: true,
			}),
			"clockNotDescriber",
		);
		await t.mutation(api.beatTheClock.send, room.s(room.hostId));
		await expectCode(
			t.mutation(api.beatTheClock.flagWord, {
				...room.s(room.noor),
				index: 0,
				flagged: true,
			}),
			"clockNotReferee",
		);
		await t.mutation(api.beatTheClock.flagWord, {
			...room.s(room.mila),
			index: 1,
			flagged: true,
		});
		await t.mutation(api.beatTheClock.confirmCheck, room.s(room.daan));
		const state = await stateOf(t, room.sessionId);
		expect(state.phase).toBe("score");
		expect(state.scores).toEqual([2, 0]);
		await expectCode(
			t.mutation(api.beatTheClock.next, room.s(room.mila)),
			"clockNotNextDescriber",
		);
		await t.mutation(api.beatTheClock.next, room.s(room.daan));
		expect((await stateOf(t, room.sessionId)).phase).toBe("ready");
	});

	it("runs the clock on the server: time's up, auto-send, auto-confirm", async () => {
		const t = setup();
		const room = await startedRoom(t);
		await t.mutation(api.beatTheClock.goTurn, room.s(room.hostId));
		await t.mutation(api.beatTheClock.tick, {
			...room.s(room.hostId),
			index: 0,
			guessed: true,
		});
		await t.finishAllScheduledFunctions(vi.runAllTimers);
		const state = await stateOf(t, room.sessionId);
		expect(state.phase).toBe("score");
		expect(state.turn?.autoConfirmed).toBe(true);
		expect(state.scores).toEqual([1, 0]);
	});

	it("ignores a stale timeout after a pause", async () => {
		const t = setup();
		const room = await startedRoom(t);
		await t.mutation(api.beatTheClock.goTurn, room.s(room.hostId));
		const deadline = (await stateOf(t, room.sessionId)).deadline as number;
		advance(10_000);
		await t.mutation(api.beatTheClock.pause, room.s(room.hostId));
		await t.mutation(internal.beatTheClock.timeout, {
			sessionId: room.sessionId,
			deadline,
		});
		const paused = await stateOf(t, room.sessionId);
		expect(paused.phase).toBe("describing");
		expect(paused.pausedRemaining).toBeGreaterThan(19_000);
		await expectCode(
			t.mutation(api.beatTheClock.pause, room.s(room.noor)),
			"hostOnly",
		);
		await t.mutation(api.beatTheClock.resume, room.s(room.hostId));
		expect((await stateOf(t, room.sessionId)).paused).toBe(false);
	});

	it("ends the game for the host and completes the session; play again reopens it", async () => {
		const t = setup();
		const room = await startedRoom(t);
		await t.mutation(api.beatTheClock.end, room.s(room.hostId));
		const finished = await viewAs(t, room.sessionId, room.hostId);
		expect(finished.state.phase).toBe("finished");
		expect(finished.state.endReason).toBe("host");
		expect(finished.session.status).toBe("completed");
		await t.mutation(api.beatTheClock.playAgain, {
			...room.s(room.hostId),
			newTeams: false,
		});
		const again = await viewAs(t, room.sessionId, room.hostId);
		expect(again.state.phase).toBe("ready");
		expect(again.session.status).toBe("active");
	});
});

describe("leaving", () => {
	it("lets a player leave but not the host", async () => {
		const t = setup();
		const room = await startedRoom(t);
		await expectCode(
			t.mutation(api.beatTheClock.leave, room.s(room.hostId)),
			"clockHostCannotLeave",
		);
		await t.mutation(api.beatTheClock.leave, room.s(room.mila));
		const state = await stateOf(t, room.sessionId);
		expect(state.left).toEqual([room.mila]);
		expect(state.members.map((m) => m.participantId)).not.toContain(room.mila);
	});

	it("drops kicked players from their team", async () => {
		const t = setup();
		const room = await startedRoom(t);
		await t.mutation(api.sessions.kickParticipant, {
			sessionId: room.sessionId,
			hostParticipantId: room.hostId,
			targetParticipantId: room.daan,
		});
		await t.mutation(api.beatTheClock.skip, room.s(room.hostId));
		// Rockets are down to one, so the game can't go on.
		const state = await stateOf(t, room.sessionId);
		expect(state.phase).toBe("finished");
		expect(state.endReason).toBe("tooFewTeams");
	});
});
