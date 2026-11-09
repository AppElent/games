import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	advance,
	deletedSessionId,
	expectCode,
	fields,
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

type Team = "red" | "blue";

/** The client flow: one `create`. */
async function newRoom(t: T) {
	const host = signedInHost(t);
	const { sessionId, participantId, joinCode } = await host.mutation(
		api.signalWords.create,
		HOSTED,
	);
	return {
		host,
		sessionId,
		hostId: participantId,
		joinCode: joinCode as string,
	};
}

function joinTeam(
	t: T,
	sessionId: SessionId,
	participantId: ParticipantId,
	team: Team,
	clueGiver: boolean,
) {
	return t.mutation(api.signalWords.joinTeam, {
		sessionId,
		participantId,
		team,
		clueGiver,
	});
}

/** Host gives red's clues; three guests fill the other seats. */
async function seatedRoom(t: T) {
	const room = await newRoom(t);
	const join = async (name: string) =>
		(await joinWithCode(t, room.joinCode, name)).participantId;
	const seats = {
		"red-clue": room.hostId,
		red: await join("guest_red"),
		"blue-clue": await join("guest_blue_clue"),
		blue: await join("guest_blue"),
	};
	await joinTeam(t, room.sessionId, seats["red-clue"], "red", true);
	await joinTeam(t, room.sessionId, seats.red, "red", false);
	await joinTeam(t, room.sessionId, seats["blue-clue"], "blue", true);
	await joinTeam(t, room.sessionId, seats.blue, "blue", false);
	return { ...room, seats };
}

async function storedState(t: T, sessionId: SessionId) {
	return (await t.run((ctx) =>
		ctx.db
			.query("signalWordsStates")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.unique(),
	)) as Doc<"signalWordsStates">;
}

async function startedGame(t: T) {
	const room = await seatedRoom(t);
	await t.mutation(api.signalWords.start, {
		sessionId: room.sessionId,
		participantId: room.hostId,
	});
	const stored = await storedState(t, room.sessionId);
	const team = stored.currentTeam;
	const rival: Team = team === "red" ? "blue" : "red";
	return {
		...room,
		stored,
		team,
		rival,
		clueGiver: room.seats[`${team}-clue`],
		guesser: room.seats[team],
		rivalClueGiver: room.seats[`${rival}-clue`],
		rivalGuesser: room.seats[rival],
	};
}

/** Started, and the current team's clue is already on the table. */
async function guessingGame(t: T, count = 9) {
	const game = await startedGame(t);
	await t.mutation(api.signalWords.submitClue, {
		sessionId: game.sessionId,
		participantId: game.clueGiver,
		clue: "ZEBRAFISH",
		count,
	});
	return game;
}

function guess(
	t: T,
	sessionId: SessionId,
	participantId: ParticipantId,
	cardIndex: number,
) {
	return t.mutation(api.signalWords.submitGuess, {
		sessionId,
		participantId,
		cardIndex,
	});
}

async function bundle(t: T, sessionId: SessionId) {
	const result = await t.query(api.signalWords.getBundle, { sessionId });
	if (!result?.state) {
		throw new Error("Expected a signal words bundle");
	}
	return { ...result, state: result.state };
}

function indexesOf(stored: Doc<"signalWordsStates">, role: string) {
	return stored.assignments.flatMap((assigned, index) =>
		assigned === role ? [index] : [],
	);
}

async function finishedOnTrap(t: T) {
	const game = await guessingGame(t);
	await guess(
		t,
		game.sessionId,
		game.guesser,
		indexesOf(game.stored, "trap")[0],
	);
	return game;
}

describe("new room", () => {
	it("creates an empty lobby board", async () => {
		const t = setup();
		const { sessionId } = await newRoom(t);
		const { state, session } = await bundle(t, sessionId);
		expect(fields(state)).toEqual({
			sessionId,
			phase: "lobby",
			words: [],
			revealed: [],
			revealedRoles: [],
			startingTeam: "red",
			currentTeam: "red",
			createdAt: T0,
			updatedAt: T0,
		});
		expect(session.status).toBe("lobby");
	});
});

describe("joining", () => {
	it("adds a code joiner with no seat until they pick a team", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newRoom(t);
		const joined = await joinWithCode(t, joinCode, "guest_two");
		expect(joined.gameType).toBe("signal-words");
		expect(joined.seatClaimed).toBe(false);
		const { participants } = await bundle(t, sessionId);
		expect(participants[1].seat).toBeUndefined();
		expect(participants[1].role).toBe("player");
	});
});

describe("joinTeam", () => {
	it("seats guessers on the team and clue givers on its clue seat", async () => {
		const t = setup();
		const { sessionId, seats } = await seatedRoom(t);
		const { participants } = await bundle(t, sessionId);
		const seatOf = (id: ParticipantId) =>
			participants.find((row) => row._id === id)?.seat;
		expect(seatOf(seats["red-clue"])).toBe("red-clue");
		expect(seatOf(seats.red)).toBe("red");
		expect(seatOf(seats["blue-clue"])).toBe("blue-clue");
		expect(seatOf(seats.blue)).toBe("blue");
	});

	it("allows many guessers per team and lets a player change seat", async () => {
		const t = setup();
		const { sessionId, joinCode, seats } = await seatedRoom(t);
		const second = await joinWithCode(t, joinCode, "guest_second");
		await joinTeam(t, sessionId, second.participantId, "red", false);
		await joinTeam(t, sessionId, seats["red-clue"], "red", true);
		await joinTeam(t, sessionId, seats.red, "blue", false);
		const { participants } = await bundle(t, sessionId);
		expect(participants.find((row) => row._id === seats.red)?.seat).toBe(
			"blue",
		);
	});

	it("answers redHasClueGiver and blueHasClueGiver when the seat is taken", async () => {
		const t = setup();
		const { sessionId, seats } = await seatedRoom(t);
		await expectCode(
			joinTeam(t, sessionId, seats.red, "red", true),
			"redHasClueGiver",
		);
		await expectCode(
			joinTeam(t, sessionId, seats.red, "blue", true),
			"blueHasClueGiver",
		);
	});

	it("answers notInGame to an outsider and to a kicked player", async () => {
		const t = setup();
		const { host, sessionId, hostId, seats } = await seatedRoom(t);
		await expectCode(
			joinTeam(t, sessionId, await outsider(t), "red", false),
			"notInGame",
		);
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: seats.blue,
		});
		await expectCode(
			joinTeam(t, sessionId, seats.blue, "blue", false),
			"notInGame",
		);
	});

	it("answers gameAlreadyStarted after the deal", async () => {
		const t = setup();
		const { sessionId, seats } = await startedGame(t);
		await expectCode(
			joinTeam(t, sessionId, seats.red, "red", false),
			"gameAlreadyStarted",
		);
	});

	it("answers gameNotFound for another game, a missing session, or no state", async () => {
		const t = setup();
		const { sessionId: noState, hostId } = await hostSession(
			t,
			"signal-words",
			"room",
		);
		for (const sessionId of [
			await otherGameSession(t),
			await deletedSessionId(t),
			noState,
		]) {
			await expectCode(
				joinTeam(t, sessionId, hostId, "red", false),
				"gameNotFound",
			);
		}
	});
});

describe("start", () => {
	it("deals the board and activates the session", async () => {
		const t = setup();
		const { sessionId, stored } = await startedGame(t);
		expect(stored.phase).toBe("clue");
		expect(stored.words).toHaveLength(25);
		expect(new Set(stored.words).size).toBe(25);
		expect(stored.revealed).toEqual(Array(25).fill(false));
		expect(stored.currentTeam).toBe(stored.startingTeam);
		const other = stored.startingTeam === "red" ? "blue" : "red";
		expect(indexesOf(stored, stored.startingTeam)).toHaveLength(9);
		expect(indexesOf(stored, other)).toHaveLength(8);
		expect(indexesOf(stored, "neutral")).toHaveLength(7);
		expect(indexesOf(stored, "trap")).toHaveLength(1);
		const { session } = await bundle(t, sessionId);
		expect(session.status).toBe("active");
		expect(session.startedAt).toBe(T0);
		expect(session.endedAt).toBeUndefined();
	});

	it("answers hostOnlyStart to a guest", async () => {
		const t = setup();
		const { sessionId, seats } = await seatedRoom(t);
		await expectCode(
			t.mutation(api.signalWords.start, {
				sessionId,
				participantId: seats.red,
			}),
			"hostOnlyStart",
		);
	});

	it("answers redTeamNotReady and blueTeamNotReady, red first", async () => {
		const t = setup();
		const { sessionId, hostId, joinCode } = await newRoom(t);
		const start = () =>
			t.mutation(api.signalWords.start, { sessionId, participantId: hostId });
		await expectCode(start(), "redTeamNotReady");
		await joinTeam(t, sessionId, hostId, "red", true);
		await expectCode(start(), "redTeamNotReady");
		const red = await joinWithCode(t, joinCode, "guest_red");
		await joinTeam(t, sessionId, red.participantId, "red", false);
		await expectCode(start(), "blueTeamNotReady");
		const blueClue = await joinWithCode(t, joinCode, "guest_blue_clue");
		await joinTeam(t, sessionId, blueClue.participantId, "blue", true);
		await expectCode(start(), "blueTeamNotReady");
	});

	it("answers gameAlreadyStarted on a second start", async () => {
		const t = setup();
		const { sessionId, hostId } = await startedGame(t);
		await expectCode(
			t.mutation(api.signalWords.start, { sessionId, participantId: hostId }),
			"gameAlreadyStarted",
		);
	});
});

describe("submitClue", () => {
	it("moves to guessing, with one bonus guess", async () => {
		const t = setup();
		const { sessionId, clueGiver } = await startedGame(t);
		advance(1000);
		await t.mutation(api.signalWords.submitClue, {
			sessionId,
			participantId: clueGiver,
			clue: "  ZEBRAFISH ",
			count: 3,
		});
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("guess");
		expect(state.clueWord).toBe("ZEBRAFISH");
		expect(state.clueCount).toBe(3);
		expect(state.guessesLeft).toBe(4);
		expect(state.updatedAt).toBe(T0 + 1000);
	});

	it("answers clueGiverOnly to guessers and the other team's clue giver", async () => {
		const t = setup();
		const { sessionId, guesser, rivalClueGiver } = await startedGame(t);
		for (const participantId of [guesser, rivalClueGiver]) {
			await expectCode(
				t.mutation(api.signalWords.submitClue, {
					sessionId,
					participantId,
					clue: "ZEBRAFISH",
					count: 1,
				}),
				"clueGiverOnly",
			);
		}
	});

	it("answers the clue errors from the rules", async () => {
		const t = setup();
		const { sessionId, clueGiver, stored } = await startedGame(t);
		const submit = (clue: string, count: number) =>
			t.mutation(api.signalWords.submitClue, {
				sessionId,
				participantId: clueGiver,
				clue,
				count,
			});
		await expectCode(submit("   ", 1), "clueEmpty");
		await expectCode(submit("two words", 1), "clueMultiWord");
		await expectCode(submit("ZEBRAFISH", 0), "clueInvalidCount");
		await expectCode(submit("ZEBRAFISH", 10), "clueInvalidCount");
		await expectCode(submit("ZEBRAFISH", 1.5), "clueInvalidCount");
		await expectCode(
			submit(stored.words[0].toLowerCase(), 1),
			"clueMatchesBoardWord",
		);
		expect((await bundle(t, sessionId)).state.phase).toBe("clue");
	});

	it("answers notExpectingClue in the lobby and during guessing", async () => {
		const t = setup();
		const room = await newRoom(t);
		await expectCode(
			t.mutation(api.signalWords.submitClue, {
				sessionId: room.sessionId,
				participantId: room.hostId,
				clue: "ZEBRAFISH",
				count: 1,
			}),
			"notExpectingClue",
		);
		const game = await guessingGame(t);
		await expectCode(
			t.mutation(api.signalWords.submitClue, {
				sessionId: game.sessionId,
				participantId: game.clueGiver,
				clue: "ANOTHER",
				count: 1,
			}),
			"notExpectingClue",
		);
	});

	it("answers notInGame to an outsider", async () => {
		const t = setup();
		const { sessionId } = await startedGame(t);
		await expectCode(
			t.mutation(api.signalWords.submitClue, {
				sessionId,
				participantId: await outsider(t),
				clue: "ZEBRAFISH",
				count: 1,
			}),
			"notInGame",
		);
	});
});

describe("submitGuess", () => {
	it("reveals a correct card and keeps guessing", async () => {
		const t = setup();
		const { sessionId, guesser, stored, team } = await guessingGame(t, 2);
		const card = indexesOf(stored, team)[0];
		await guess(t, sessionId, guesser, card);
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("guess");
		expect(state.guessesLeft).toBe(2);
		expect(state.revealed[card]).toBe(true);
		expect(state.revealedRoles[card]).toBe(team);
		expect(state.revealedRoles.filter((role) => role !== null)).toHaveLength(1);
		expect(state.currentTeam).toBe(team);
	});

	it("finishes on the trap, for the other team and its clue giver too", async () => {
		const t = setup();
		const { sessionId, rival, rivalClueGiver, rivalGuesser, team, stored } =
			await finishedOnTrap(t);
		const { state, session } = await bundle(t, sessionId);
		expect(state.phase).toBe("finished");
		expect(state.winnerTeam).toBe(rival);
		expect(state.trapHitBy).toBe(team);
		expect(state.revealedRoles).toEqual(stored.assignments);
		expect(session.status).toBe("completed");
		expect(session.completedReason).toBe("finished");
		expect(session.endedAt).toBe(T0);
		expect(session.participantCount).toBe(4);
		expect(new Set(session.winnerParticipantIds)).toEqual(
			new Set([rivalClueGiver, rivalGuesser]),
		);
		expect(session.winnerParticipantIds).toHaveLength(2);
	});

	it("finishes when the guessing team clears its last card", async () => {
		const t = setup();
		const { sessionId, guesser, clueGiver, stored, team } =
			await guessingGame(t);
		for (const card of indexesOf(stored, team)) {
			await guess(t, sessionId, guesser, card);
		}
		const { state, session } = await bundle(t, sessionId);
		expect(state.phase).toBe("finished");
		expect(state.winnerTeam).toBe(team);
		expect(state.trapHitBy).toBeUndefined();
		expect(new Set(session.winnerParticipantIds)).toEqual(
			new Set([clueGiver, guesser]),
		);
	});

	it("answers guessersOnlyPick to clue givers and the other team", async () => {
		const t = setup();
		const { sessionId, clueGiver, rivalGuesser } = await guessingGame(t);
		for (const participantId of [clueGiver, rivalGuesser]) {
			await expectCode(
				guess(t, sessionId, participantId, 0),
				"guessersOnlyPick",
			);
		}
	});

	it("answers invalidCard and cardAlreadyRevealed", async () => {
		const t = setup();
		const { sessionId, guesser, stored, team } = await guessingGame(t);
		for (const card of [-1, 25, 1.5]) {
			await expectCode(guess(t, sessionId, guesser, card), "invalidCard");
		}
		const card = indexesOf(stored, team)[0];
		await guess(t, sessionId, guesser, card);
		await expectCode(guess(t, sessionId, guesser, card), "cardAlreadyRevealed");
	});

	it("answers notExpectingGuess outside the guessing phase", async () => {
		const t = setup();
		const { sessionId, guesser } = await startedGame(t);
		await expectCode(guess(t, sessionId, guesser, 0), "notExpectingGuess");
	});
});

describe("pass", () => {
	it("hands the turn over and clears the clue", async () => {
		const t = setup();
		const { sessionId, guesser, rival } = await guessingGame(t);
		await t.mutation(api.signalWords.pass, {
			sessionId,
			participantId: guesser,
		});
		const { state } = await bundle(t, sessionId);
		expect(state.phase).toBe("clue");
		expect(state.currentTeam).toBe(rival);
		expect(state.clueWord).toBeUndefined();
		expect(state.guessesLeft).toBeUndefined();
	});

	it("answers guessersOnlyPass and passOnlyDuringGuess", async () => {
		const t = setup();
		const game = await startedGame(t);
		await expectCode(
			t.mutation(api.signalWords.pass, {
				sessionId: game.sessionId,
				participantId: game.guesser,
			}),
			"passOnlyDuringGuess",
		);
		await t.mutation(api.signalWords.submitClue, {
			sessionId: game.sessionId,
			participantId: game.clueGiver,
			clue: "ZEBRAFISH",
			count: 1,
		});
		for (const participantId of [game.clueGiver, game.rivalGuesser]) {
			await expectCode(
				t.mutation(api.signalWords.pass, {
					sessionId: game.sessionId,
					participantId,
				}),
				"guessersOnlyPass",
			);
		}
	});
});

describe("rematch", () => {
	it("deals a new board, keeps the seats, and reopens the session", async () => {
		const t = setup();
		const { sessionId, hostId, seats } = await finishedOnTrap(t);
		advance(5000);
		await t.mutation(api.signalWords.rematch, {
			sessionId,
			participantId: hostId,
		});
		const stored = await storedState(t, sessionId);
		expect(stored.phase).toBe("clue");
		expect(stored.words).toHaveLength(25);
		expect(stored.revealed).toEqual(Array(25).fill(false));
		expect(stored.currentTeam).toBe(stored.startingTeam);
		expect(stored.clueWord).toBeUndefined();
		expect(stored.winnerTeam).toBeUndefined();
		expect(stored.trapHitBy).toBeUndefined();
		expect(stored.updatedAt).toBe(T0 + 5000);
		const { session, participants, state } = await bundle(t, sessionId);
		expect(state.revealedRoles).toEqual(Array(25).fill(null));
		expect(session.status).toBe("active");
		expect(session.startedAt).toBe(T0);
		expect(session.endedAt).toBeUndefined();
		expect(session.completedReason).toBeUndefined();
		expect(session.winnerParticipantIds).toBeUndefined();
		expect(participants.find((row) => row._id === seats.red)?.seat).toBe("red");
	});

	it("answers hostOnlyRematch and currentGameNotFinished", async () => {
		const t = setup();
		const started = await startedGame(t);
		await expectCode(
			t.mutation(api.signalWords.rematch, {
				sessionId: started.sessionId,
				participantId: started.hostId,
			}),
			"currentGameNotFinished",
		);
		const finished = await finishedOnTrap(t);
		await expectCode(
			t.mutation(api.signalWords.rematch, {
				sessionId: finished.sessionId,
				participantId: finished.seats.red,
			}),
			"hostOnlyRematch",
		);
	});
});

describe("getBundle", () => {
	it("hides the key until a card is revealed", async () => {
		const t = setup();
		const { sessionId } = await startedGame(t);
		const result = await t.query(api.signalWords.getBundle, { sessionId });
		expect(Object.keys(result ?? {}).sort()).toEqual([
			"participants",
			"session",
			"state",
		]);
		expect(result?.state).not.toHaveProperty("assignments");
		expect(result?.state?.revealedRoles).toEqual(Array(25).fill(null));
	});

	it("is null for a missing session, and state is null on a session without one", async () => {
		const t = setup();
		await expect(
			t.query(api.signalWords.getBundle, {
				sessionId: await deletedSessionId(t),
			}),
		).resolves.toBeNull();
		const { sessionId } = await hostSession(t, "signal-words", "room");
		const result = await t.query(api.signalWords.getBundle, { sessionId });
		expect(result?.state).toBeNull();
		expect(result?.participants).toHaveLength(1);
	});
});

describe("getKey", () => {
	it("gives clue givers the key and everyone else null", async () => {
		const t = setup();
		const { sessionId, seats, stored } = await startedGame(t);
		for (const seat of ["red-clue", "blue-clue"] as const) {
			await expect(
				t.query(api.signalWords.getKey, {
					sessionId,
					participantId: seats[seat],
				}),
			).resolves.toEqual(stored.assignments);
		}
		await expect(
			t.query(api.signalWords.getKey, {
				sessionId,
				participantId: seats.red,
			}),
		).resolves.toBeNull();
	});

	it("pins that a clue giver's public id is enough to read the key", async () => {
		const t = setup();
		const { sessionId, stored } = await startedGame(t);
		const { participants } = await bundle(t, sessionId);
		const clueSeat = participants.find((row) => row.seat === "blue-clue");
		await expect(
			t
				.withIdentity({ subject: "user_stranger" })
				.query(api.signalWords.getKey, {
					sessionId,
					participantId: clueSeat?._id as ParticipantId,
				}),
		).resolves.toEqual(stored.assignments);
	});

	it("answers notInGame to an outsider and is null for a seatless player", async () => {
		const t = setup();
		const { sessionId, hostId } = await newRoom(t);
		await expectCode(
			t.query(api.signalWords.getKey, {
				sessionId,
				participantId: await outsider(t),
			}),
			"notInGame",
		);
		await expect(
			t.query(api.signalWords.getKey, { sessionId, participantId: hostId }),
		).resolves.toBeNull();
	});
});

describe("create", () => {
	it("returns a code a guest can type, and no link", async () => {
		const t = setup();
		const created = await signedInHost(t).mutation(
			api.signalWords.create,
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
		await expectCode(
			t.mutation(api.signalWords.create, HOSTED),
			"signInToHost",
		);
		expect(await sessionCount(t)).toBe(0);
	});
});
