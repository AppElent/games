import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import {
	advance,
	arrange,
	deletedSessionId,
	expectCode,
	fields,
	fixRandom,
	freezeClock,
	getDoc,
	HOSTED,
	hostSession,
	joinWithCode,
	joinWithToken,
	otherGameSession,
	type ParticipantId,
	type SessionId,
	sessionCount,
	setup,
	shareTokenOf,
	signedInHost,
	type T,
	T0,
} from "./test.helpers";

freezeClock();

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const TEN_MINUTES = 600_000;

/** The client flow: challenge session, then its state. */
async function newMatch(
	t: T,
	options: {
		timeControl?: "untimed" | "10+0";
		hostColor?: "white" | "black" | "random";
	} = {},
) {
	const host = signedInHost(t);
	const { sessionId, participantId } = await host.mutation(api.chess.create, {
		...HOSTED,
		timeControl: options.timeControl ?? "untimed",
		hostColor: options.hostColor ?? "white",
	});
	return { host, sessionId, hostId: participantId };
}

/** The host plays white and a guest follows the link as black. */
async function fullMatch(t: T, timeControl: "untimed" | "10+0" = "untimed") {
	const { sessionId, hostId } = await newMatch(t, { timeControl });
	const joined = await joinWithToken(
		t,
		await shareTokenOf(t, sessionId),
		"guest_black",
	);
	return { sessionId, white: hostId, black: joined.participantId };
}

async function bundle(t: T, sessionId: SessionId) {
	const result = await t.query(api.chess.getBundle, { sessionId });
	if (!result?.state) {
		throw new Error("Expected a chess bundle");
	}
	return { ...result, state: result.state };
}

function move(
	t: T,
	sessionId: SessionId,
	participantId: ParticipantId,
	from: string,
	to: string,
	promotion?: "q" | "r" | "b" | "n",
) {
	return t.mutation(api.chess.applyMove, {
		sessionId,
		participantId,
		from,
		to,
		promotion,
	});
}

async function foolsMate(
	t: T,
	sessionId: SessionId,
	white: ParticipantId,
	black: ParticipantId,
) {
	await move(t, sessionId, white, "f2", "f3");
	await move(t, sessionId, black, "e7", "e5");
	await move(t, sessionId, white, "g2", "g4");
	await move(t, sessionId, black, "d8", "h4");
}

/** Both players have moved once, so both clocks have run. */
async function runningClock(t: T) {
	const match = await fullMatch(t, "10+0");
	await move(t, match.sessionId, match.white, "e2", "e4");
	await move(t, match.sessionId, match.black, "e7", "e5");
	return match;
}

async function expectFinished(
	t: T,
	sessionId: SessionId,
	expected: {
		outcome: string;
		winner?: "white" | "black";
		winnerParticipantId?: ParticipantId;
	},
) {
	const { state, session } = await bundle(t, sessionId);
	expect(state.phase).toBe("finished");
	expect(state.resultOutcome).toBe(expected.outcome);
	expect(state.resultWinner).toBe(expected.winner);
	expect(state.winnerParticipantId).toBe(expected.winnerParticipantId);
	expect(state.drawOfferBy).toBeUndefined();
	expect(session.status).toBe("completed");
	expect(session.completedReason).toBe("finished");
	expect(session.endedAt).toBe(Date.now());
	expect(session.winnerParticipantIds).toEqual(
		expected.winnerParticipantId ? [expected.winnerParticipantId] : [],
	);
}

describe("new game", () => {
	it("seats a white host in an untimed game", async () => {
		const t = setup();
		const { sessionId, hostId } = await newMatch(t);
		const { state, session } = await bundle(t, sessionId);
		expect(fields(state)).toEqual({
			sessionId,
			phase: "waiting",
			whiteParticipantId: hostId,
			fen: INITIAL_FEN,
			sanHistory: [],
			activeColor: "white",
			timeControl: "untimed",
			createdAt: T0,
			updatedAt: T0,
		});
		expect((await getDoc(t, hostId))?.seat).toBe("white");
		expect(session.status).toBe("lobby");
	});

	it("seats a black host and loads both clocks without starting them", async () => {
		const t = setup();
		const { sessionId, hostId } = await newMatch(t, {
			timeControl: "10+0",
			hostColor: "black",
		});
		const { state } = await bundle(t, sessionId);
		expect(state.blackParticipantId).toBe(hostId);
		expect(state.whiteParticipantId).toBeUndefined();
		expect(state.remainingWhiteMs).toBe(TEN_MINUTES);
		expect(state.remainingBlackMs).toBe(TEN_MINUTES);
		expect(state.turnStartedAt).toBeUndefined();
		expect((await getDoc(t, hostId))?.seat).toBe("black");
	});

	it("resolves a random colour on the coin flip", async () => {
		const t = setup();
		fixRandom(0.25);
		const first = await newMatch(t, { hostColor: "random" });
		expect((await getDoc(t, first.hostId))?.seat).toBe("white");
		fixRandom(0.75);
		const second = await newMatch(t, { hostColor: "random" });
		expect((await getDoc(t, second.hostId))?.seat).toBe("black");
	});
});

describe("joining", () => {
	it("seats a link joiner black opposite a white host, leaving the phase alone", async () => {
		const t = setup();
		const { sessionId, hostId } = await newMatch(t);
		advance(500);
		const joined = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_two",
		);
		expect(joined).toEqual({
			sessionId,
			participantId: joined.participantId,
			gameType: "chess",
			seatClaimed: false,
		});
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("waiting");
		expect(state.whiteParticipantId).toBe(hostId);
		expect(state.blackParticipantId).toBe(joined.participantId);
		expect(state.updatedAt).toBe(T0 + 500);
		const row = await getDoc(t, joined.participantId);
		expect(row?.seat).toBe("black");
		expect(row?.role).toBe("player");
	});

	it("seats a link joiner white opposite a black host", async () => {
		const t = setup();
		const { sessionId, hostId } = await newMatch(t, { hostColor: "black" });
		const joined = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_two",
		);
		const { state } = await bundle(t, sessionId);
		expect(state.whiteParticipantId).toBe(joined.participantId);
		expect(state.blackParticipantId).toBe(hostId);
		expect((await getDoc(t, joined.participantId))?.seat).toBe("white");
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
		const { sessionId, black } = await fullMatch(t);
		const again = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_black",
		);
		expect(again.participantId).toBe(black);
		const row = await getDoc(t, black);
		expect(row?.seat).toBe("black");
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
			(await bundle(t, sessionId)).state.blackParticipantId,
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
		expect(row?.seat).toBe("black");
		expect(row?.role).toBe("watcher");
		expect((await bundle(t, sessionId)).state.blackParticipantId).toBe(
			first.participantId,
		);
	});

	it("pins that a room-code join never seats the joiner", async () => {
		const t = setup();
		const { sessionId } = await newMatch(t);
		await arrange(t, sessionId, { joinMode: "room", joinCode: "ROOM01" });
		const joined = await joinWithCode(t, "ROOM01", "guest_code");
		const row = await getDoc(t, joined.participantId);
		expect(row?.role).toBe("player");
		expect(row?.seat).toBeUndefined();
		expect(
			(await bundle(t, sessionId)).state.blackParticipantId,
		).toBeUndefined();
	});
});

describe("applyMove", () => {
	it("plays the first move and activates the session", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t);
		advance(1000);
		await move(t, sessionId, white, "e2", "e4");
		const { state, session } = await bundle(t, sessionId);
		expect(fields(state)).toEqual({
			sessionId,
			phase: "active",
			whiteParticipantId: white,
			blackParticipantId: black,
			fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
			sanHistory: ["e4"],
			activeColor: "black",
			timeControl: "untimed",
			createdAt: T0,
			updatedAt: T0 + 1000,
		});
		expect(session.status).toBe("active");
		expect(session.startedAt).toBe(T0 + 1000);
	});

	it("keeps the first startedAt on later moves", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t);
		await move(t, sessionId, white, "e2", "e4");
		advance(4000);
		await move(t, sessionId, black, "e7", "e5");
		expect((await bundle(t, sessionId)).session.startedAt).toBe(T0);
	});

	it("waits for an opponent", async () => {
		const t = setup();
		const { sessionId, hostId } = await newMatch(t);
		await expectCode(
			move(t, sessionId, hostId, "e2", "e4"),
			"waitingForOpponent",
		);
	});

	it("answers notSeated to a watcher and notYourTurn to the other seat", async () => {
		const t = setup();
		const { sessionId, black } = await fullMatch(t);
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
		);
		await expectCode(
			move(t, sessionId, watcher.participantId, "e2", "e4"),
			"notSeated",
		);
		await expectCode(move(t, sessionId, black, "e7", "e5"), "notYourTurn");
	});

	it("answers illegalMove, including for a malformed square", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		await expectCode(move(t, sessionId, white, "e2", "e5"), "illegalMove");
		await expectCode(move(t, sessionId, white, "zz", "e4"), "illegalMove");
		expect((await bundle(t, sessionId)).state.sanHistory).toEqual([]);
	});

	it("answers gameNotFound for another game, a missing session, or no state", async () => {
		const t = setup();
		const { sessionId: noState, hostId } = await hostSession(
			t,
			"chess",
			"challenge",
		);
		for (const sessionId of [
			await otherGameSession(t),
			await deletedSessionId(t),
			noState,
		]) {
			await expectCode(move(t, sessionId, hostId, "e2", "e4"), "gameNotFound");
		}
	});

	it("passes the promotion piece through", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, { fen: "k7/7P/8/8/8/8/8/K7 w - - 0 1" });
		await move(t, sessionId, white, "h7", "h8", "n");
		expect((await bundle(t, sessionId)).state.sanHistory).toEqual(["h8=N"]);
	});

	it("clears a pending draw offer", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t);
		await move(t, sessionId, white, "e2", "e4");
		await t.mutation(api.chess.offerDraw, { sessionId, participantId: white });
		await move(t, sessionId, black, "e7", "e5");
		expect((await bundle(t, sessionId)).state.drawOfferBy).toBeUndefined();
	});

	it("finishes on checkmate", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t);
		await foolsMate(t, sessionId, white, black);
		await expectFinished(t, sessionId, {
			outcome: "checkmate",
			winner: "black",
			winnerParticipantId: black,
		});
		const { state, session } = await bundle(t, sessionId);
		expect(state.sanHistory).toEqual(["f3", "e5", "g4", "Qh4#"]);
		expect(state.activeColor).toBe("white");
		expect(session.participantCount).toBe(2);
		await expectCode(
			move(t, sessionId, white, "a2", "a3"),
			"gameAlreadyFinished",
		);
	});

	it("finishes on a drawn position with no winner", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		const { state } = await bundle(t, sessionId);
		await arrange(t, state._id, { fen: "7k/8/6K1/5Q2/8/8/8/8 w - - 0 1" });
		await move(t, sessionId, white, "f5", "f7");
		await expectFinished(t, sessionId, { outcome: "stalemate" });
	});
});

describe("clock", () => {
	it("starts on the first move without charging it", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t, "10+0");
		advance(30_000);
		await move(t, sessionId, white, "e2", "e4");
		const { state } = await bundle(t, sessionId);
		expect(state.remainingWhiteMs).toBe(TEN_MINUTES);
		expect(state.remainingBlackMs).toBe(TEN_MINUTES);
		expect(state.turnStartedAt).toBe(T0 + 30_000);
	});

	it("charges each later move to the player who made it", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t, "10+0");
		await move(t, sessionId, white, "e2", "e4");
		advance(7000);
		await move(t, sessionId, black, "e7", "e5");
		const first = (await bundle(t, sessionId)).state;
		expect(first.remainingBlackMs).toBe(TEN_MINUTES - 7000);
		expect(first.remainingWhiteMs).toBe(TEN_MINUTES);
		expect(first.turnStartedAt).toBe(T0 + 7000);
		advance(2000);
		await move(t, sessionId, white, "g1", "f3");
		const second = (await bundle(t, sessionId)).state;
		expect(second.remainingWhiteMs).toBe(TEN_MINUTES - 2000);
		expect(second.remainingBlackMs).toBe(TEN_MINUTES - 7000);
	});

	it("pins that a flag fall on a move throws timeRanOut and rolls the finish back", async () => {
		const t = setup();
		const { sessionId, white } = await runningClock(t);
		advance(TEN_MINUTES + 1);
		await expectCode(move(t, sessionId, white, "g1", "f3"), "timeRanOut");
		const { state, session } = await bundle(t, sessionId);
		expect(state.phase).toBe("active");
		expect(state.resultOutcome).toBeUndefined();
		expect(state.sanHistory).toEqual(["e4", "e5"]);
		expect(session.status).toBe("active");
		expect(session.endedAt).toBeUndefined();
	});

	it("lets the opponent claim the win once the flag has fallen", async () => {
		const t = setup();
		const { sessionId, black } = await runningClock(t);
		advance(TEN_MINUTES + 1);
		await t.mutation(api.chess.claimTimeout, {
			sessionId,
			participantId: black,
		});
		await expectFinished(t, sessionId, {
			outcome: "timeout",
			winner: "black",
			winnerParticipantId: black,
		});
	});

	it("answers opponentHasTime early, and on the claimant's own turn", async () => {
		const t = setup();
		const { sessionId, white, black } = await runningClock(t);
		advance(1000);
		await expectCode(
			t.mutation(api.chess.claimTimeout, { sessionId, participantId: black }),
			"opponentHasTime",
		);
		advance(TEN_MINUTES);
		await expectCode(
			t.mutation(api.chess.claimTimeout, { sessionId, participantId: white }),
			"opponentHasTime",
		);
	});

	it("answers gameUntimed, noActiveGame, and notSeated", async () => {
		const t = setup();
		const untimed = await fullMatch(t);
		await expectCode(
			t.mutation(api.chess.claimTimeout, {
				sessionId: untimed.sessionId,
				participantId: untimed.black,
			}),
			"noActiveGame",
		);
		await move(t, untimed.sessionId, untimed.white, "e2", "e4");
		await expectCode(
			t.mutation(api.chess.claimTimeout, {
				sessionId: untimed.sessionId,
				participantId: untimed.white,
			}),
			"gameUntimed",
		);
		const timed = await runningClock(t);
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, timed.sessionId),
			"guest_watch",
		);
		await expectCode(
			t.mutation(api.chess.claimTimeout, {
				sessionId: timed.sessionId,
				participantId: watcher.participantId,
			}),
			"notSeated",
		);
	});
});

describe("resign", () => {
	it("hands the win to the other seat", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t);
		advance(1000);
		await t.mutation(api.chess.resign, { sessionId, participantId: white });
		await expectFinished(t, sessionId, {
			outcome: "resignation",
			winner: "black",
			winnerParticipantId: black,
		});
	});

	it("pins that a host can resign with nobody seated opposite", async () => {
		const t = setup();
		const { sessionId, hostId } = await newMatch(t);
		await t.mutation(api.chess.resign, { sessionId, participantId: hostId });
		await expectFinished(t, sessionId, {
			outcome: "resignation",
			winner: "black",
		});
	});

	it("answers notSeated and gameAlreadyFinished", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
		);
		await expectCode(
			t.mutation(api.chess.resign, {
				sessionId,
				participantId: watcher.participantId,
			}),
			"notSeated",
		);
		await t.mutation(api.chess.resign, { sessionId, participantId: white });
		await expectCode(
			t.mutation(api.chess.resign, { sessionId, participantId: white }),
			"gameAlreadyFinished",
		);
	});
});

describe("draw offers", () => {
	async function underway(t: T) {
		const match = await fullMatch(t);
		await move(t, match.sessionId, match.white, "e2", "e4");
		return match;
	}

	it("records an offer, and keeps it when the same player repeats it", async () => {
		const t = setup();
		const { sessionId, white } = await underway(t);
		for (const _ of [1, 2]) {
			await t.mutation(api.chess.offerDraw, {
				sessionId,
				participantId: white,
			});
			const { state } = await bundle(t, sessionId);
			expect(state.phase).toBe("active");
			expect(state.drawOfferBy).toBe("white");
		}
	});

	it("draws when both players offer", async () => {
		const t = setup();
		const { sessionId, white, black } = await underway(t);
		await t.mutation(api.chess.offerDraw, { sessionId, participantId: white });
		await t.mutation(api.chess.offerDraw, { sessionId, participantId: black });
		await expectFinished(t, sessionId, { outcome: "drawAgreed" });
	});

	it("draws on acceptance and clears the offer on refusal", async () => {
		const t = setup();
		const { sessionId, white, black } = await underway(t);
		await t.mutation(api.chess.offerDraw, { sessionId, participantId: white });
		await t.mutation(api.chess.respondDraw, {
			sessionId,
			participantId: black,
			accept: false,
		});
		const declined = (await bundle(t, sessionId)).state;
		expect(declined.drawOfferBy).toBeUndefined();
		expect(declined.phase).toBe("active");
		await t.mutation(api.chess.offerDraw, { sessionId, participantId: white });
		await t.mutation(api.chess.respondDraw, {
			sessionId,
			participantId: black,
			accept: true,
		});
		await expectFinished(t, sessionId, { outcome: "drawAgreed" });
	});

	it("answers noActiveGame for an offer before the first move", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		await expectCode(
			t.mutation(api.chess.offerDraw, { sessionId, participantId: white }),
			"noActiveGame",
		);
	});

	it("answers noDrawOffer, ownOffer, and notSeated to a response", async () => {
		const t = setup();
		const { sessionId, white, black } = await underway(t);
		await expectCode(
			t.mutation(api.chess.respondDraw, {
				sessionId,
				participantId: black,
				accept: true,
			}),
			"noDrawOffer",
		);
		await t.mutation(api.chess.offerDraw, { sessionId, participantId: white });
		await expectCode(
			t.mutation(api.chess.respondDraw, {
				sessionId,
				participantId: white,
				accept: true,
			}),
			"ownOffer",
		);
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
		);
		await expectCode(
			t.mutation(api.chess.respondDraw, {
				sessionId,
				participantId: watcher.participantId,
				accept: true,
			}),
			"notSeated",
		);
		await expectCode(
			t.mutation(api.chess.offerDraw, {
				sessionId,
				participantId: watcher.participantId,
			}),
			"notSeated",
		);
	});
});

describe("rematch", () => {
	it("swaps colours, starts active at once, and reopens the session", async () => {
		const t = setup();
		const { sessionId, white, black } = await fullMatch(t);
		await foolsMate(t, sessionId, white, black);
		const finished = await bundle(t, sessionId);
		advance(5000);
		await t.mutation(api.chess.rematch, { sessionId, participantId: white });
		const { state, session } = await bundle(t, sessionId);
		expect(fields(state)).toEqual({
			sessionId,
			phase: "active",
			whiteParticipantId: black,
			blackParticipantId: white,
			fen: INITIAL_FEN,
			sanHistory: [],
			activeColor: "white",
			timeControl: "untimed",
			createdAt: T0,
			updatedAt: T0 + 5000,
		});
		expect((await getDoc(t, black))?.seat).toBe("white");
		expect((await getDoc(t, white))?.seat).toBe("black");
		expect(session.status).toBe("active");
		expect(session.endedAt).toBeUndefined();
		expect(session.completedReason).toBeUndefined();
		expect(session.winnerParticipantIds).toBeUndefined();
		expect(session.startedAt).toBe(finished.session.startedAt);
		await expectCode(move(t, sessionId, white, "e2", "e4"), "notYourTurn");
		await move(t, sessionId, black, "e2", "e4");
	});

	it("starts a timed rematch's clock immediately", async () => {
		const t = setup();
		const { sessionId, white, black } = await runningClock(t);
		await t.mutation(api.chess.resign, { sessionId, participantId: black });
		advance(5000);
		await t.mutation(api.chess.rematch, { sessionId, participantId: black });
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("active");
		expect(state.remainingWhiteMs).toBe(TEN_MINUTES);
		expect(state.remainingBlackMs).toBe(TEN_MINUTES);
		expect(state.turnStartedAt).toBe(T0 + 5000);
		expect(state.whiteParticipantId).toBe(black);
		expect(state.blackParticipantId).toBe(white);
	});

	it("answers currentGameNotFinished during play", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		await expectCode(
			t.mutation(api.chess.rematch, { sessionId, participantId: white }),
			"currentGameNotFinished",
		);
	});

	it("answers notSeated to a watcher", async () => {
		const t = setup();
		const { sessionId, white } = await fullMatch(t);
		const watcher = await joinWithToken(
			t,
			await shareTokenOf(t, sessionId),
			"guest_watch",
		);
		await t.mutation(api.chess.resign, { sessionId, participantId: white });
		await expectCode(
			t.mutation(api.chess.rematch, {
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
		const { sessionId, white, black } = await fullMatch(t);
		const result = await t.query(api.chess.getBundle, { sessionId });
		expect(Object.keys(result ?? {}).sort()).toEqual([
			"participants",
			"session",
			"state",
		]);
		expect(result?.participants.map((row) => row._id)).toEqual([white, black]);
	});

	it("is null for a missing session, and state is null for a session without one", async () => {
		const t = setup();
		await expect(
			t.query(api.chess.getBundle, { sessionId: await deletedSessionId(t) }),
		).resolves.toBeNull();
		const { sessionId } = await hostSession(t, "chess", "challenge");
		expect(
			(await t.query(api.chess.getBundle, { sessionId }))?.state,
		).toBeNull();
	});
});

const ARGS = {
	...HOSTED,
	timeControl: "untimed",
	hostColor: "white",
} as const;

describe("create", () => {
	it("returns a link a guest can follow, and no room code", async () => {
		const t = setup();
		const created = await signedInHost(t).mutation(api.chess.create, ARGS);
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
		await expectCode(t.mutation(api.chess.create, ARGS), "signInToHost");
		expect(await sessionCount(t)).toBe(0);
	});

	it.each([
		["white", 0.4],
		["black", 0.6],
	] as const)("resolves a random host color to %s", async (color, roll) => {
		const t = setup();
		fixRandom(roll);
		const { sessionId, participantId } = await signedInHost(t).mutation(
			api.chess.create,
			{ ...ARGS, hostColor: "random" },
		);
		expect((await getDoc(t, participantId))?.seat).toBe(color);
		const state = await t.query(api.chess.getBundle, { sessionId });
		expect(state?.state?.[`${color}ParticipantId`]).toBe(participantId);
	});
});
