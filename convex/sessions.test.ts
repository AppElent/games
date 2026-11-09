import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import {
	advance,
	afterCommits,
	arrange,
	deletedParticipantId,
	deletedSessionId,
	expectCode,
	fields,
	fixRandom,
	freezeClock,
	getDoc,
	HOST_USER,
	hostSession,
	joinWithCode,
	joinWithToken,
	type ParticipantId,
	type SessionId,
	setup,
	shareTokenOf,
	type T,
	T0,
} from "./test.helpers";

freezeClock();

/** Quiz sessions have no seats, so these rows show the session layer alone. */
const GAME = "live-quiz";

function guestSolo(t: T) {
	return t.mutation(api.sessions.create, {
		gameType: "sudoku",
		joinMode: "solo",
		authPolicy: "guestAllowed",
		title: "Solo",
		displayName: "Solver",
		guestId: "guest_solver",
	});
}

function room(t: T, authPolicy?: "guestAllowed" | "signedInRequired") {
	return hostSession(t, GAME, "room", authPolicy) as Promise<
		Awaited<ReturnType<typeof hostSession>> & { joinCode: string }
	>;
}

async function challenge(
	t: T,
	authPolicy?: "guestAllowed" | "signedInRequired",
) {
	const created = await hostSession(t, GAME, "challenge", authPolicy);
	return { ...created, shareToken: await shareTokenOf(t, created.sessionId) };
}

function asUser(t: T, subject = "user_joiner") {
	return t.withIdentity({ subject });
}

async function allParticipants(t: T, sessionId: SessionId) {
	const result = await t.query(api.sessions.getBundle, { sessionId });
	return result?.participants ?? [];
}

function setStatus(
	t: T,
	sessionId: SessionId,
	status: "completed" | "cancelled",
) {
	return arrange(t, sessionId, { status });
}

describe("create", () => {
	it("stores a guest's solo session and host row, with no invite", async () => {
		const t = setup();
		const created = await guestSolo(t);
		expect(Object.keys(created).sort()).toEqual(["participantId", "sessionId"]);
		expect(fields(await getDoc(t, created.sessionId))).toEqual({
			gameType: "sudoku",
			status: "lobby",
			joinMode: "solo",
			authPolicy: "guestAllowed",
			title: "Solo",
			hostParticipantId: created.participantId,
		});
		expect(fields(await getDoc(t, created.participantId))).toEqual({
			sessionId: created.sessionId,
			guestId: "guest_solver",
			displayName: "Solver",
			role: "host",
			seat: "host",
			connected: true,
			lastSeen: T0,
		});
	});

	it("gives a room a join code, and drops the guest id of a signed-in host", async () => {
		const t = setup();
		const { sessionId, hostId, joinCode } = await room(t);
		expect(joinCode).toMatch(/^[A-Z2-9]{6}$/);
		expect(fields(await getDoc(t, sessionId))).toEqual({
			gameType: GAME,
			status: "lobby",
			joinMode: "room",
			authPolicy: "guestAllowed",
			title: "Game",
			hostUserId: HOST_USER,
			joinCode,
			hostParticipantId: hostId,
		});
		expect(fields(await getDoc(t, hostId))).toEqual({
			sessionId,
			userId: HOST_USER,
			displayName: "Host",
			role: "host",
			seat: "host",
			connected: true,
			lastSeen: T0,
		});
	});

	it("gives a challenge a share token and no join code", async () => {
		const t = setup();
		const { sessionId, joinCode, shareToken } = await challenge(t);
		expect(joinCode).toBeUndefined();
		expect(shareToken).toMatch(/^share_[0-9a-f]{32}$/);
		expect((await getDoc(t, sessionId))?.joinCode).toBeUndefined();
	});

	it("answers signInToHost to a guest hosting anything but an open solo game", async () => {
		const t = setup();
		for (const [joinMode, authPolicy] of [
			["room", "guestAllowed"],
			["challenge", "guestAllowed"],
			["solo", "signedInRequired"],
		] as const) {
			await expectCode(
				t.mutation(api.sessions.create, {
					gameType: GAME,
					joinMode,
					authPolicy,
					title: "x",
					displayName: "x",
				}),
				"signInToHost",
			);
		}
	});

	it("answers gameUnavailable for card games, which have their own create", async () => {
		const t = setup();
		await expectCode(
			asUser(t).mutation(api.sessions.create, {
				gameType: "card-games",
				joinMode: "room",
				authPolicy: "guestAllowed",
				title: "x",
				displayName: "x",
			}),
			"gameUnavailable",
		);
	});

	it("answers joinCodeFailed when every code it tries is taken", async () => {
		const t = setup();
		fixRandom(0);
		await room(t);
		await expectCode(room(t), "joinCodeFailed");
	});
});

describe("inviteGameType", () => {
	it("names the game behind a token or a loosely typed code", async () => {
		const t = setup();
		const byToken = await challenge(t);
		await expect(
			t.query(api.sessions.inviteGameType, {
				shareToken: byToken.shareToken,
			}),
		).resolves.toBe(GAME);
		const byCode = await room(t);
		const typed = `${byCode.joinCode.slice(0, 3).toLowerCase()}-${byCode.joinCode.slice(3).toLowerCase()} `;
		await expect(
			t.query(api.sessions.inviteGameType, { joinCode: typed }),
		).resolves.toBe(GAME);
		expect(await allParticipants(t, byCode.sessionId)).toHaveLength(1);
	});

	it("is null for no invite, an unknown invite, or a closed session", async () => {
		const t = setup();
		await expect(t.query(api.sessions.inviteGameType, {})).resolves.toBeNull();
		await expect(
			t.query(api.sessions.inviteGameType, { shareToken: "nope" }),
		).resolves.toBeNull();
		await expect(
			t.query(api.sessions.inviteGameType, { joinCode: "NOPE22" }),
		).resolves.toBeNull();
		for (const status of ["completed", "cancelled"] as const) {
			const { sessionId, shareToken } = await challenge(t);
			await setStatus(t, sessionId, status);
			await expect(
				t.query(api.sessions.inviteGameType, { shareToken }),
			).resolves.toBeNull();
		}
	});
});

describe("joinByCode", () => {
	it("adds a player and reports no card seat", async () => {
		const t = setup();
		const { sessionId, joinCode } = await room(t);
		const joined = await joinWithCode(t, joinCode, "guest_one");
		expect(joined).toEqual({
			sessionId,
			participantId: joined.participantId,
			gameType: GAME,
			seatClaimed: false,
		});
		expect(fields(await getDoc(t, joined.participantId))).toEqual({
			sessionId,
			guestId: "guest_one",
			displayName: "guest_one",
			role: "player",
			connected: true,
			lastSeen: T0,
		});
	});

	it("normalizes the typed code", async () => {
		const t = setup();
		const { sessionId, joinCode } = await room(t);
		const typed = ` ${joinCode.slice(0, 3).toLowerCase()}-${joinCode.slice(3)}`;
		const joined = await joinWithCode(t, typed, "guest_one");
		expect(joined.sessionId).toBe(sessionId);
	});

	it("adds a spectator as a watcher", async () => {
		const t = setup();
		const { joinCode } = await room(t);
		const joined = await joinWithCode(t, joinCode, "guest_watch", {
			asSpectator: true,
		});
		expect(joined.seatClaimed).toBe(false);
		const row = await getDoc(t, joined.participantId);
		expect(row?.role).toBe("watcher");
		expect(row?.seat).toBeUndefined();
	});

	it("stores a signed-in joiner by user id, without their guest id", async () => {
		const t = setup();
		const { joinCode } = await room(t);
		const joined = await asUser(t).mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "Joiner",
			guestId: "guest_ignored",
		});
		const row = await getDoc(t, joined.participantId);
		expect(row?.userId).toBe("user_joiner");
		expect(row?.guestId).toBeUndefined();
	});

	it("reclaims a guest's row and refreshes presence, not the name", async () => {
		const t = setup();
		const { sessionId, joinCode } = await room(t);
		const first = await joinWithCode(t, joinCode, "guest_one");
		await arrange(t, first.participantId, { connected: false });
		advance(1000);
		const again = await t.mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "New name",
			guestId: "guest_one",
		});
		expect(again.participantId).toBe(first.participantId);
		const row = await getDoc(t, first.participantId);
		expect(row?.connected).toBe(true);
		expect(row?.lastSeen).toBe(T0 + 1000);
		expect(row?.displayName).toBe("guest_one");
		expect(await allParticipants(t, sessionId)).toHaveLength(2);
	});

	it("reclaims a signed-in user's row by user id, whatever the guest id", async () => {
		const t = setup();
		const { sessionId, joinCode } = await room(t);
		const first = await asUser(t).mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "Joiner",
			guestId: "guest_a",
		});
		const again = await asUser(t).mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "Joiner",
			guestId: "guest_b",
		});
		expect(again.participantId).toBe(first.participantId);
		expect(await allParticipants(t, sessionId)).toHaveLength(2);
	});

	it("keeps a returning row's role, whichever way they ask to join", async () => {
		const t = setup();
		const { joinCode } = await room(t);
		const watcher = await joinWithCode(t, joinCode, "guest_watch", {
			asSpectator: true,
		});
		await joinWithCode(t, joinCode, "guest_watch");
		expect((await getDoc(t, watcher.participantId))?.role).toBe("watcher");
		const player = await joinWithCode(t, joinCode, "guest_play");
		await joinWithCode(t, joinCode, "guest_play", { asSpectator: true });
		expect((await getDoc(t, player.participantId))?.role).toBe("player");
	});

	it("pins that a joiner with no identity gets a new row every time", async () => {
		const t = setup();
		const { sessionId, joinCode } = await room(t);
		const args = { joinCode, displayName: "Anon" };
		const first = await t.mutation(api.sessions.joinByCode, args);
		const second = await t.mutation(api.sessions.joinByCode, args);
		expect(second.participantId).not.toBe(first.participantId);
		expect(await allParticipants(t, sessionId)).toHaveLength(3);
	});

	it("pins that signing in leaves the guest's old row behind", async () => {
		const t = setup();
		const { sessionId, joinCode } = await room(t);
		const asGuest = await joinWithCode(t, joinCode, "guest_one");
		const signedIn = await asUser(t).mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "guest_one",
			guestId: "guest_one",
		});
		expect(signedIn.participantId).not.toBe(asGuest.participantId);
		expect(await allParticipants(t, sessionId)).toHaveLength(3);
	});

	it("ignores a seat secret outside card games", async () => {
		const t = setup();
		const { joinCode } = await room(t);
		const joined = await t.mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "x",
			guestId: "guest_one",
			seatSecret: "secret",
		});
		expect(joined.seatClaimed).toBe(false);
	});

	it("answers roomNotFound for an unknown or closed room", async () => {
		const t = setup();
		await expectCode(joinWithCode(t, "NOPE22", "guest_one"), "roomNotFound");
		for (const status of ["completed", "cancelled"] as const) {
			const { sessionId, joinCode } = await room(t);
			await setStatus(t, sessionId, status);
			await expectCode(joinWithCode(t, joinCode, "guest_one"), "roomNotFound");
		}
	});

	it("still lets anyone into a room that has started", async () => {
		const t = setup();
		const { sessionId, joinCode } = await room(t);
		await arrange(t, sessionId, { status: "active" });
		const joined = await joinWithCode(t, joinCode, "guest_one");
		expect(joined.sessionId).toBe(sessionId);
	});

	it("answers roomLocked to a newcomer, but lets a known row back in", async () => {
		const t = setup();
		const { host, sessionId, hostId, joinCode } = await room(t);
		const known = await joinWithCode(t, joinCode, "guest_known");
		await host.mutation(api.sessions.setLocked, {
			sessionId,
			hostParticipantId: hostId,
			locked: true,
		});
		await expectCode(joinWithCode(t, joinCode, "guest_new"), "roomLocked");
		const again = await joinWithCode(t, joinCode, "guest_known");
		expect(again.participantId).toBe(known.participantId);
	});

	it("answers removedByHost to a kicked row, even with the lock open", async () => {
		const t = setup();
		const { host, sessionId, hostId, joinCode } = await room(t);
		const kicked = await joinWithCode(t, joinCode, "guest_kicked");
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: kicked.participantId,
		});
		await expectCode(
			joinWithCode(t, joinCode, "guest_kicked"),
			"removedByHost",
		);
	});

	it("answers signInToJoin to a guest of a members-only room", async () => {
		const t = setup();
		const { joinCode } = await room(t, "signedInRequired");
		await expectCode(joinWithCode(t, joinCode, "guest_one"), "signInToJoin");
		await expect(
			asUser(t).mutation(api.sessions.joinByCode, {
				joinCode,
				displayName: "Joiner",
			}),
		).resolves.toMatchObject({ gameType: GAME });
	});
});

describe("joinByToken", () => {
	it("adds a player with no seat outside the duels", async () => {
		const t = setup();
		const { sessionId, shareToken } = await challenge(t);
		const joined = await joinWithToken(t, shareToken, "guest_one");
		expect(joined).toEqual({
			sessionId,
			participantId: joined.participantId,
			gameType: GAME,
			seatClaimed: false,
		});
		expect(fields(await getDoc(t, joined.participantId))).toEqual({
			sessionId,
			guestId: "guest_one",
			displayName: "guest_one",
			role: "player",
			connected: true,
			lastSeen: T0,
		});
	});

	it("adds a spectator as a watcher", async () => {
		const t = setup();
		const { shareToken } = await challenge(t);
		const joined = await joinWithToken(t, shareToken, "guest_watch", {
			asSpectator: true,
		});
		expect((await getDoc(t, joined.participantId))?.role).toBe("watcher");
	});

	it("reclaims a row and refreshes presence", async () => {
		const t = setup();
		const { sessionId, shareToken } = await challenge(t);
		const first = await joinWithToken(t, shareToken, "guest_one");
		await arrange(t, first.participantId, { connected: false });
		advance(1000);
		const again = await joinWithToken(t, shareToken, "guest_one");
		expect(again.participantId).toBe(first.participantId);
		const row = await getDoc(t, first.participantId);
		expect(row?.connected).toBe(true);
		expect(row?.lastSeen).toBe(T0 + 1000);
		expect(await allParticipants(t, sessionId)).toHaveLength(2);
	});

	it("answers gameUnavailable for an unknown or closed token", async () => {
		const t = setup();
		await expectCode(joinWithToken(t, "nope", "guest_one"), "gameUnavailable");
		for (const status of ["completed", "cancelled"] as const) {
			const { sessionId, shareToken } = await challenge(t);
			await setStatus(t, sessionId, status);
			await expectCode(
				joinWithToken(t, shareToken, "guest_one"),
				"gameUnavailable",
			);
		}
	});

	it("answers roomLocked, removedByHost, and signInToJoin like the code route", async () => {
		const t = setup();
		const { host, sessionId, hostId, shareToken } = await challenge(t);
		const kicked = await joinWithToken(t, shareToken, "guest_kicked");
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: kicked.participantId,
		});
		await expectCode(
			joinWithToken(t, shareToken, "guest_kicked"),
			"removedByHost",
		);
		await host.mutation(api.sessions.setLocked, {
			sessionId,
			hostParticipantId: hostId,
			locked: true,
		});
		await expectCode(joinWithToken(t, shareToken, "guest_new"), "roomLocked");

		const membersOnly = await challenge(t, "signedInRequired");
		await expectCode(
			joinWithToken(t, membersOnly.shareToken, "guest_one"),
			"signInToJoin",
		);
	});
});

describe("getBundle", () => {
	it("is null for a missing session", async () => {
		const t = setup();
		await expect(
			t.query(api.sessions.getBundle, {
				sessionId: await deletedSessionId(t),
			}),
		).resolves.toBeNull();
	});

	it("pins that every participant's guest and user ids ship to all readers", async () => {
		const t = setup();
		const { sessionId, joinCode } = await room(t);
		await joinWithCode(t, joinCode, "guest_one");
		const result = await t.query(api.sessions.getBundle, { sessionId });
		expect(Object.keys(result ?? {}).sort()).toEqual([
			"participants",
			"session",
		]);
		expect(result?.session._id).toBe(sessionId);
		expect(result?.participants.map((row) => row.userId)).toEqual([
			HOST_USER,
			undefined,
		]);
		expect(result?.participants.map((row) => row.guestId)).toEqual([
			undefined,
			"guest_one",
		]);
	});
});

describe("heartbeat", () => {
	it("marks a row connected, with no identity", async () => {
		const t = setup();
		const { hostId } = await room(t);
		await arrange(t, hostId, { connected: false });
		advance(1000);
		await t.mutation(api.sessions.heartbeat, { participantId: hostId });
		const row = await getDoc(t, hostId);
		expect(row?.connected).toBe(true);
		expect(row?.lastSeen).toBe(T0 + 1000);
	});

	it("pins that a kicked row can mark itself connected again", async () => {
		const t = setup();
		const { host, sessionId, hostId, joinCode } = await room(t);
		const { participantId } = await joinWithCode(t, joinCode, "guest_one");
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: participantId,
		});
		await t.mutation(api.sessions.heartbeat, { participantId });
		const row = await getDoc(t, participantId);
		expect(row?.connected).toBe(true);
		expect(row?.kickedAt).toBe(afterCommits(T0));
	});

	it("answers participantNotFound for a missing row", async () => {
		const t = setup();
		const { sessionId } = await room(t);
		await expectCode(
			t.mutation(api.sessions.heartbeat, {
				participantId: await deletedParticipantId(t, sessionId),
			}),
			"participantNotFound",
		);
	});
});

describe("host controls", () => {
	async function roomWithGuest(t: T) {
		const created = await room(t);
		const { participantId } = await joinWithCode(
			t,
			created.joinCode,
			"guest_one",
		);
		return { ...created, guest: participantId };
	}

	function kick(
		t: T,
		sessionId: SessionId,
		hostParticipantId: ParticipantId,
		targetParticipantId: ParticipantId,
	) {
		return t.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId,
			targetParticipantId,
		});
	}

	it("kicks by stamping the row and disconnecting it", async () => {
		const t = setup();
		const { host, sessionId, hostId, guest } = await roomWithGuest(t);
		advance(1000);
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: guest,
		});
		const row = await getDoc(t, guest);
		expect(row?.kickedAt).toBe(T0 + 1000);
		expect(row?.connected).toBe(false);
		expect(await allParticipants(t, sessionId)).toHaveLength(2);
	});

	it("answers gameNotFound for a missing session on every control", async () => {
		const t = setup();
		const { hostId, guest } = await roomWithGuest(t);
		const sessionId = await deletedSessionId(t);
		const hostParticipantId = hostId;
		await expectCode(kick(t, sessionId, hostId, guest), "gameNotFound");
		await expectCode(
			t.mutation(api.sessions.setLocked, {
				sessionId,
				hostParticipantId,
				locked: true,
			}),
			"gameNotFound",
		);
		await expectCode(
			t.mutation(api.sessions.rename, {
				sessionId,
				hostParticipantId,
				title: "x",
			}),
			"gameNotFound",
		);
		await expectCode(
			t.mutation(api.sessions.transferHost, {
				sessionId,
				hostParticipantId,
				targetParticipantId: guest,
			}),
			"gameNotFound",
		);
	});

	it("answers hostOnly to a non-host id, on every control", async () => {
		const t = setup();
		const { host, sessionId, guest } = await roomWithGuest(t);
		const args = { sessionId, hostParticipantId: guest };
		await expectCode(
			host.mutation(api.sessions.kickParticipant, {
				...args,
				targetParticipantId: guest,
			}),
			"hostOnly",
		);
		await expectCode(
			host.mutation(api.sessions.setLocked, { ...args, locked: true }),
			"hostOnly",
		);
		await expectCode(
			host.mutation(api.sessions.rename, { ...args, title: "x" }),
			"hostOnly",
		);
		await expectCode(
			host.mutation(api.sessions.transferHost, {
				...args,
				targetParticipantId: guest,
			}),
			"hostOnly",
		);
	});

	it("answers hostOnly when a signed-in host's id comes from anyone else", async () => {
		const t = setup();
		const { sessionId, hostId, guest } = await roomWithGuest(t);
		await expectCode(kick(t, sessionId, hostId, guest), "hostOnly");
		await expectCode(
			asUser(t).mutation(api.sessions.kickParticipant, {
				sessionId,
				hostParticipantId: hostId,
				targetParticipantId: guest,
			}),
			"hostOnly",
		);
		expect((await getDoc(t, guest))?.kickedAt).toBeUndefined();
	});

	it("pins that a guest host proves itself with its participant id alone", async () => {
		const t = setup();
		const { sessionId, participantId } = await guestSolo(t);
		await t.mutation(api.sessions.setLocked, {
			sessionId,
			hostParticipantId: participantId,
			locked: true,
		});
		expect((await getDoc(t, sessionId))?.locked).toBe(true);
	});

	it("answers hostCannotKickSelf", async () => {
		const t = setup();
		const { host, sessionId, hostId } = await room(t);
		await expectCode(
			host.mutation(api.sessions.kickParticipant, {
				sessionId,
				hostParticipantId: hostId,
				targetParticipantId: hostId,
			}),
			"hostCannotKickSelf",
		);
	});

	it("answers participantNotFound for a kick target that is gone or elsewhere", async () => {
		const t = setup();
		const { host, sessionId, hostId } = await room(t);
		const elsewhere = await room(t);
		for (const targetParticipantId of [
			elsewhere.hostId,
			await deletedParticipantId(t, sessionId),
		]) {
			await expectCode(
				host.mutation(api.sessions.kickParticipant, {
					sessionId,
					hostParticipantId: hostId,
					targetParticipantId,
				}),
				"participantNotFound",
			);
		}
	});

	it("sets and clears the lock", async () => {
		const t = setup();
		const { host, sessionId, hostId } = await room(t);
		const args = { sessionId, hostParticipantId: hostId };
		await host.mutation(api.sessions.setLocked, { ...args, locked: true });
		expect((await getDoc(t, sessionId))?.locked).toBe(true);
		await host.mutation(api.sessions.setLocked, { ...args, locked: false });
		expect((await getDoc(t, sessionId))?.locked).toBe(false);
	});

	it("renames with a trim, up to 80 characters", async () => {
		const t = setup();
		const { host, sessionId, hostId } = await room(t);
		const args = { sessionId, hostParticipantId: hostId };
		const longest = "x".repeat(80);
		await host.mutation(api.sessions.rename, {
			...args,
			title: `  ${longest}  `,
		});
		expect((await getDoc(t, sessionId))?.title).toBe(longest);
		for (const title of ["   ", "x".repeat(81)]) {
			await expectCode(
				host.mutation(api.sessions.rename, { ...args, title }),
				"titleLength",
			);
		}
		expect((await getDoc(t, sessionId))?.title).toBe(longest);
	});

	it("transfers to a guest, keeping the old host's user id on the session", async () => {
		const t = setup();
		const { host, sessionId, hostId, guest } = await roomWithGuest(t);
		await host.mutation(api.sessions.transferHost, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: guest,
		});
		const session = await getDoc(t, sessionId);
		expect(session?.hostParticipantId).toBe(guest);
		expect(session?.hostUserId).toBe(HOST_USER);
		expect((await getDoc(t, guest))?.role).toBe("host");
		const oldHost = await getDoc(t, hostId);
		expect(oldHost?.role).toBe("player");
		await expectCode(
			host.mutation(api.sessions.setLocked, {
				sessionId,
				hostParticipantId: hostId,
				locked: true,
			}),
			"hostOnly",
		);
	});

	it("pins that the old host keeps the seat named host after a transfer", async () => {
		const t = setup();
		const { host, sessionId, hostId, guest } = await roomWithGuest(t);
		await host.mutation(api.sessions.transferHost, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: guest,
		});
		expect((await getDoc(t, hostId))?.seat).toBe("host");
		expect((await getDoc(t, guest))?.seat).toBeUndefined();
	});

	it("moves the session's user id to a signed-in target", async () => {
		const t = setup();
		const { host, sessionId, hostId, joinCode } = await room(t);
		const joined = await asUser(t).mutation(api.sessions.joinByCode, {
			joinCode,
			displayName: "Joiner",
		});
		await host.mutation(api.sessions.transferHost, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: joined.participantId,
		});
		expect((await getDoc(t, sessionId))?.hostUserId).toBe("user_joiner");
		await asUser(t).mutation(api.sessions.setLocked, {
			sessionId,
			hostParticipantId: joined.participantId,
			locked: true,
		});
		expect((await getDoc(t, sessionId))?.locked).toBe(true);
	});

	it("pins that a transfer to yourself leaves the host with role player", async () => {
		const t = setup();
		const { host, sessionId, hostId } = await room(t);
		await host.mutation(api.sessions.transferHost, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: hostId,
		});
		expect((await getDoc(t, hostId))?.role).toBe("player");
		expect((await getDoc(t, sessionId))?.hostParticipantId).toBe(hostId);
	});

	it("answers participantNotFound for a transfer target that is kicked, gone, or elsewhere", async () => {
		const t = setup();
		const { host, sessionId, hostId, guest } = await roomWithGuest(t);
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: guest,
		});
		const elsewhere = await room(t);
		for (const targetParticipantId of [
			guest,
			elsewhere.hostId,
			await deletedParticipantId(t, sessionId),
		]) {
			await expectCode(
				host.mutation(api.sessions.transferHost, {
					sessionId,
					hostParticipantId: hostId,
					targetParticipantId,
				}),
				"participantNotFound",
			);
		}
	});
});

describe("listParticipation", () => {
	it("answers signInRequired to a guest", async () => {
		const t = setup();
		await expectCode(
			t.query(api.sessions.listParticipation, {}),
			"signInRequired",
		);
	});

	it("lists hosted and joined sessions newest first, with the caller's own row", async () => {
		const t = setup();
		const hosted = await hostSession(t, GAME, "solo");
		const joinedRoom = await room(t);
		const joined = await t
			.withIdentity({ subject: HOST_USER })
			.mutation(api.sessions.joinByCode, {
				joinCode: joinedRoom.joinCode,
				displayName: "Host",
			});
		expect(joined.participantId).toBe(joinedRoom.hostId);
		const created = await asUser(t, "user_other").mutation(
			api.sessions.create,
			{
				gameType: GAME,
				joinMode: "room",
				authPolicy: "guestAllowed",
				title: "Theirs",
				displayName: "Other",
			},
		);
		const theirs = await t
			.withIdentity({ subject: HOST_USER })
			.mutation(api.sessions.joinByCode, {
				joinCode: created.joinCode as string,
				displayName: "Host",
			});
		const rows = await t
			.withIdentity({ subject: HOST_USER })
			.query(api.sessions.listParticipation, {});
		expect(rows.map((row) => row.session._id)).toEqual([
			created.sessionId,
			joinedRoom.sessionId,
			hosted.sessionId,
		]);
		expect(rows.map((row) => row.participant._id)).toEqual([
			theirs.participantId,
			joinedRoom.hostId,
			hosted.hostId,
		]);
		expect(rows.map((row) => row.participant.role)).toEqual([
			"player",
			"host",
			"host",
		]);
		expect(Object.keys(rows[0]).sort()).toEqual(["participant", "session"]);
	});

	it("skips a row whose session is gone", async () => {
		const t = setup();
		const { sessionId } = await hostSession(t, GAME, "solo");
		await t.run((ctx) => ctx.db.delete(sessionId));
		await expect(
			t
				.withIdentity({ subject: HOST_USER })
				.query(api.sessions.listParticipation, {}),
		).resolves.toEqual([]);
	});

	it("reads only the latest 100 rows", async () => {
		const t = setup();
		const oldest = await hostSession(t, GAME, "solo");
		for (let index = 0; index < 100; index += 1) {
			await hostSession(t, GAME, "solo");
		}
		const rows = await t
			.withIdentity({ subject: HOST_USER })
			.query(api.sessions.listParticipation, {});
		expect(rows).toHaveLength(100);
		expect(rows.map((row) => row.session._id)).not.toContain(oldest.sessionId);
	});
});
