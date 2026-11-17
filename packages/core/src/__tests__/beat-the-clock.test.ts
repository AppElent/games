import { describe, expect, it } from "vitest";
import {
	bestDescriber,
	CLOCK_AUTO_SEND_MS,
	CLOCK_CHECK_MS,
	type ClockState,
	canSeeWords,
	clockRole,
	confirm,
	createClockState,
	endGame,
	flag,
	go,
	leave,
	lobbyReady,
	nextTurn,
	pause,
	pickTeam,
	rematch,
	resume,
	secondsLeft,
	seeWinner,
	send,
	shuffleTeams,
	skipTurn,
	startExtraRound,
	startGame,
	teamMembers,
	teamOf,
	tick,
	timeout,
	upcomingTurn,
} from "../beat-the-clock";
import {
	CLOCK_PACK_IDS,
	clockPackCards,
	clockPackWords,
	clockWords,
} from "../beat-the-clock-packs";
import { GameRuleError } from "../errors";
import { joinNames } from "../i18n/format";
import { mulberry32 } from "../random";

const SETTINGS = {
	packId: "everyday",
	locale: "en",
	turnSeconds: 30,
	target: 20,
	teamCount: 2,
};
const PACK = clockPackWords("everyday", "en").length;
const PLAYERS = ["sam", "noor", "daan", "mila"];

function expectCode(apply: () => unknown, code: string) {
	try {
		apply();
	} catch (caught) {
		expect(caught).toBeInstanceOf(GameRuleError);
		expect((caught as GameRuleError).code).toBe(code);
		return;
	}
	throw new Error(`expected ${code}`);
}

/** Comets: sam, noor. Rockets: daan, mila. First turn dealt at t=0. */
function started(extra: Partial<typeof SETTINGS> = {}) {
	let state = createClockState({ ...SETTINGS, ...extra });
	state = pickTeam(state, "sam", 0);
	state = pickTeam(state, "noor", 0);
	state = pickTeam(state, "daan", 1);
	state = pickTeam(state, "mila", 1);
	return startGame(state, PLAYERS, PACK, mulberry32(1), 0);
}

/** Plays the running turn: Go, tick `guessed` words, send, confirm by a referee. */
function playTurn(state: ClockState, guessed: number, now = 1000) {
	const turn = state.turn;
	if (!turn) throw new Error("no turn");
	let next: ClockState = go(state, turn.describerId, now);
	for (let i = 0; i < guessed; i += 1) {
		next = tick(next, turn.describerId, i, true);
	}
	next = send(next, turn.describerId, now + 5000);
	const referee = next.members.find((m) => m.team !== turn.team);
	return confirm(next, referee?.participantId, now + 6000);
}

describe("lobby", () => {
	it("refuses settings off the menu", () => {
		expectCode(
			() => createClockState({ ...SETTINGS, turnSeconds: 31 }),
			"clockBadSettings",
		);
		expectCode(
			() => createClockState({ ...SETTINGS, teamCount: 5 }),
			"clockBadSettings",
		);
	});

	it("lets players pick and switch teams, keeping their join order", () => {
		let state = createClockState(SETTINGS);
		state = pickTeam(state, "sam", 0);
		state = pickTeam(state, "noor", 1);
		state = pickTeam(state, "sam", 1);
		expect(teamMembers(state, 1).map((m) => m.participantId)).toEqual([
			"sam",
			"noor",
		]);
		expectCode(() => pickTeam(state, "sam", 2), "clockBadTeam");
	});

	it("needs two players per team, placing players without a team in the smallest", () => {
		let state = createClockState(SETTINGS);
		state = pickTeam(state, "sam", 0);
		state = pickTeam(state, "noor", 0);
		state = pickTeam(state, "daan", 1);
		expect(lobbyReady(state, ["sam", "noor", "daan"])).toBe(false);
		expectCode(
			() => startGame(state, ["sam", "noor", "daan"], PACK, mulberry32(1), 0),
			"clockTeamsNeedTwo",
		);
		expect(lobbyReady(state, PLAYERS)).toBe(true);
		const game = startGame(state, PLAYERS, PACK, mulberry32(1), 0);
		expect(teamMembers(game, 1).map((m) => m.participantId)).toEqual([
			"daan",
			"mila",
		]);
	});

	it("shuffles everyone evenly over the teams", () => {
		const players = ["a", "b", "c", "d", "e", "f"];
		const state = shuffleTeams(
			createClockState({ ...SETTINGS, teamCount: 3 }),
			players,
			mulberry32(4),
		);
		expect([0, 1, 2].map((team) => teamMembers(state, team).length)).toEqual([
			2, 2, 2,
		]);
	});
});

describe("a turn", () => {
	it("deals five unused words to the first team's first describer", () => {
		const state = started();
		expect(state.phase).toBe("ready");
		expect(state.turn?.team).toBe(0);
		expect(state.turn?.describerId).toBe("sam");
		expect(new Set(state.turn?.words).size).toBe(5);
		expect(state.deck).toHaveLength(PACK - 5);
		expect(state.turnNumber).toBe(1);
	});

	it("only lets the describer start, tick and send", () => {
		const state = started();
		expectCode(() => go(state, "noor", 0), "clockNotDescriber");
		const running = go(state, "sam", 1000);
		expect(running.deadline).toBe(31_000);
		expectCode(() => tick(running, "daan", 0, true), "clockNotDescriber");
		expectCode(() => send(running, "noor", 2000), "clockNotDescriber");
		expectCode(() => tick(running, "sam", 5, true), "clockBadWord");
	});

	it("runs out into time's up, where ticks can only be undone, then sends itself", () => {
		let state: ClockState = go(started(), "sam", 0);
		state = tick(state, "sam", 0, true);
		state = tick(state, "sam", 1, true);
		expect(timeout(state, 29_000)).toBe(state);
		state = timeout(state, 30_000);
		expect(state.phase).toBe("timeUp");
		expect(state.deadline).toBe(30_000 + CLOCK_AUTO_SEND_MS);
		expectCode(() => tick(state, "sam", 2, true), "clockTimeUp");
		state = tick(state, "sam", 1, false);
		state = timeout(state, 40_000);
		expect(state.phase).toBe("checking");
		expect(state.deadline).toBe(40_000 + CLOCK_CHECK_MS);
		expect(state.turn?.ticks).toEqual([true, false, false, false, false]);
	});

	it("lets any referee flag a ticked word; flagged words don't count", () => {
		let state: ClockState = go(started(), "sam", 0);
		for (const i of [0, 1, 2]) state = tick(state, "sam", i, true);
		state = send(state, "sam", 5000);
		expectCode(() => flag(state, "noor", 0, true), "clockNotReferee");
		expectCode(() => flag(state, "daan", 3, true), "clockBadWord");
		state = flag(state, "daan", 0, true);
		state = flag(state, "mila", 1, true);
		state = flag(state, "daan", 1, false);
		expect(state.turn?.flags).toEqual(["daan", "", "", "", ""]);
		expectCode(() => confirm(state, "noor", 6000), "clockNotReferee");
		state = confirm(state, "mila", 6000);
		expect(state.phase).toBe("score");
		expect(state.scores).toEqual([2, 0]);
		expect(state.turn?.gain).toBe(2);
		expect(state.turn?.confirmedBy).toBe("mila");
		expect(state.described).toEqual([{ participantId: "sam", words: 2 }]);
	});

	it("confirms itself when nobody confirms", () => {
		let state: ClockState = go(started(), "sam", 0);
		state = tick(state, "sam", 0, true);
		state = send(state, "sam", 1000);
		state = timeout(state, 1000 + CLOCK_CHECK_MS);
		expect(state.phase).toBe("score");
		expect(state.turn?.autoConfirmed).toBe(true);
		expect(state.scores).toEqual([1, 0]);
	});

	it("hands Next to the upcoming describer only", () => {
		const state = playTurn(started(), 2);
		expect(upcomingTurn(state)).toEqual({ team: 1, describerId: "daan" });
		expectCode(() => nextTurn(state, "mila", 9000), "clockNotNextDescriber");
		const next = nextTurn(state, "daan", 9000);
		expect(next.phase).toBe("ready");
		expect(next.turn?.team).toBe(1);
		expect(next.turnNumber).toBe(2);
	});

	it("rotates describers within a team", () => {
		let state = started();
		state = playTurn(state, 1);
		state = nextTurn(state, "daan", 0);
		state = playTurn(state, 1);
		expect(state.round).toBe(2);
		state = nextTurn(state, "noor", 0);
		expect(state.turn?.describerId).toBe("noor");
	});
});

describe("words on screen", () => {
	it("shows the card to the describer and referees, never to teammates during the turn", () => {
		const ready = started();
		expect(canSeeWords(ready, "describer")).toBe(false);
		const running = go(ready, "sam", 0);
		expect(clockRole(running, "sam", false)).toBe("describer");
		expect(clockRole(running, "noor", false)).toBe("teammate");
		expect(clockRole(running, "daan", false)).toBe("opponent");
		expect(clockRole(running, "zoe", false)).toBe("waiting");
		expect(clockRole(running, "zoe", true)).toBe("watcher");
		expect(canSeeWords(running, "describer")).toBe(true);
		expect(canSeeWords(running, "opponent")).toBe(true);
		expect(canSeeWords(running, "teammate")).toBe(false);
		expect(canSeeWords(running, "watcher")).toBe(false);
		expect(canSeeWords(pause(running, 1000), "describer")).toBe(false);
		expect(canSeeWords(send(running, "sam", 2000), "teammate")).toBe(true);
	});
});

describe("end of a round", () => {
	it("plays the round out, then the highest team at or above the target wins", () => {
		let state = started({ target: 20 });
		state = { ...state, scores: [18, 17] };
		state = playTurn(state, 3); // Comets 21, round not done
		expect(state.roundOutcome).toBe("none");
		state = nextTurn(state, "daan", 0);
		state = playTurn(state, 2); // Rockets 19
		expect(state.roundOutcome).toBe("win");
		expectCode(() => nextTurn(state, "noor", 0), "clockWrongPhase");
		state = seeWinner(state);
		expect(state.phase).toBe("finished");
		expect(state.endReason).toBe("target");
		expect(state.winners).toEqual([0]);
	});

	it("plays an extra round on a tie at the top", () => {
		let state = { ...started({ target: 20 }), scores: [18, 18] };
		state = playTurn(state, 3);
		state = nextTurn(state, "daan", 0);
		state = playTurn(state, 3);
		expect(state.roundOutcome).toBe("tie");
		state = seeWinner(state);
		expect(state.phase).toBe("tie");
		state = startExtraRound(state, 0);
		expect(state.phase).toBe("ready");
		expect(state.round).toBe(2);
		expect(state.turn?.team).toBe(0);
	});

	it("ends when the pack runs out", () => {
		const state = { ...started(), deck: [1, 2, 3] };
		const scored = playTurn(state, 1);
		const next = nextTurn(scored, "daan", 0);
		expect(next.phase).toBe("finished");
		expect(next.endReason).toBe("ranOut");
	});
});

describe("host controls", () => {
	it("skips a running turn with no points, and the next team is up", () => {
		const running = go(started(), "sam", 0);
		const skipped = skipTurn(running, 1000);
		expect(skipped.phase).toBe("ready");
		expect(skipped.turn?.team).toBe(1);
		expect(skipped.scores).toEqual([0, 0]);
		expect(skipped.notice).toEqual({ kind: "skipped", team: 0, at: 1000 });
	});

	it("skips the upcoming turn from the score screen", () => {
		const scored = playTurn(started(), 2);
		const skipped = skipTurn(scored, 9000);
		expect(skipped.round).toBe(2);
		expect(skipped.turn?.team).toBe(0);
		expect(skipped.turn?.describerId).toBe("noor");
		expect(skipped.scores).toEqual([2, 0]);
	});

	it("freezes and resumes the clock", () => {
		const running = go(started(), "sam", 0);
		const paused = pause(running, 12_000);
		expect(paused.pausedRemaining).toBe(18_000);
		expect(timeout(paused, 40_000)).toBe(paused);
		expect(secondsLeft(paused, 99_000)).toBe(18);
		expectCode(() => tick(paused, "sam", 0, true), "clockPaused");
		const resumed = resume(paused, 50_000);
		expect(resumed.deadline).toBe(68_000);
		expect(secondsLeft(resumed, 60_000)).toBe(8);
	});

	it("ends the game with the current scores", () => {
		const state = endGame({ ...go(started(), "sam", 0), scores: [4, 4] });
		expect(state.phase).toBe("finished");
		expect(state.endReason).toBe("host");
		expect(state.winners).toEqual([0, 1]);
	});
});

describe("players coming and going", () => {
	it("sends the ticks when the describer leaves mid-turn", () => {
		let state: ClockState = go(started(), "sam", 0);
		state = tick(state, "sam", 0, true);
		state = leave(state, "sam", 3000);
		expect(state.phase).toBe("checking");
	});

	it("skips a team that drops below two on its ready screen; too few teams ends the game", () => {
		let state = createClockState({ ...SETTINGS, teamCount: 3 });
		for (const [id, team] of [
			["a", 0],
			["b", 0],
			["c", 1],
			["d", 1],
			["e", 2],
			["f", 2],
		] as const) {
			state = pickTeam(state, id, team);
		}
		state = startGame(
			state,
			["a", "b", "c", "d", "e", "f"],
			PACK,
			mulberry32(2),
			0,
		);
		const deckBefore = state.deck.length;
		state = leave(state, "a", 500);
		expect(state.turn?.team).toBe(1);
		expect(state.notice).toEqual({ kind: "skippedShort", team: 0, at: 500 });
		expect(state.deck).toHaveLength(deckBefore);
		state = leave(state, "e", 600);
		const scored = playTurn(state, 1);
		// No team that can still play: the game ends as the turn scores.
		expect(scored.endReason).toBe("tooFewTeams");
	});

	it("blocks a switch that would leave a team short, and applies others after the next turn", () => {
		let state = started();
		expectCode(() => pickTeam(state, "noor", 1), "clockSwitchBlocked");
		state = pickTeam(state, "zoe", 0); // late joiner
		expect(clockRole(state, "zoe", false)).toBe("waiting");
		state = playTurn(state, 0);
		expect(teamMembers(state, 0).map((m) => m.participantId)).toEqual([
			"sam",
			"noor",
			"zoe",
		]);
		// Comets now have three, so one can switch; it applies after the next turn.
		state = pickTeam(state, "sam", 1);
		expect(teamOf(state, "sam")).toBe(0);
		state = nextTurn(state, "daan", 0);
		state = playTurn(state, 0);
		expect(teamOf(state, "sam")).toBe(1);
	});
});

describe("after the game", () => {
	it("plays again with the same teams, keeping used words out", () => {
		const finished = endGame(playTurn(started(), 2));
		const again = rematch(finished, PLAYERS, PACK, mulberry32(9), 0, false);
		expect(again.phase).toBe("ready");
		expect(again.scores).toEqual([0, 0]);
		for (const word of finished.turn?.words ?? []) {
			expect(again.deck).not.toContain(word);
		}
	});

	it("returns to the lobby when a team is short or for new teams", () => {
		const finished = endGame(started());
		expect(
			rematch(finished, ["sam", "noor", "daan"], PACK, mulberry32(9), 0, false)
				.phase,
		).toBe("lobby");
		const fresh = rematch(finished, PLAYERS, PACK, mulberry32(9), 0, true);
		expect(fresh.phase).toBe("lobby");
		expect(fresh.members).toEqual([]);
	});

	it("names the best describer, but not on a tie", () => {
		const state = started();
		expect(
			bestDescriber({
				...state,
				described: [
					{ participantId: "sam", words: 4 },
					{ participantId: "daan", words: 2 },
				],
			}),
		).toBe("sam");
		expect(
			bestDescriber({
				...state,
				described: [
					{ participantId: "sam", words: 4 },
					{ participantId: "daan", words: 4 },
				],
			}),
		).toBeUndefined();
	});
});

describe("word packs", () => {
	for (const packId of CLOCK_PACK_IDS) {
		for (const locale of ["en", "nl"]) {
			it(`${packId} (${locale}) is a clean list of at least 25 cards`, () => {
				const words = clockPackWords(packId, locale);
				expect(clockPackCards(packId, locale)).toBeGreaterThanOrEqual(25);
				const lower = words.map((word) => word.toLowerCase());
				expect(new Set(lower).size).toBe(words.length);
				for (const word of words) {
					expect(word).toBe(word.trim());
					expect(word.length).toBeGreaterThanOrEqual(2);
					expect(word.length).toBeLessThanOrEqual(24);
				}
			});
		}
	}

	it("resolves dealt indices to words", () => {
		expect(clockWords("everyday", "en", [0, 1])).toEqual([
			"Lighthouse",
			"Pancake",
		]);
	});
});

describe("joinNames", () => {
	it("joins with commas and the language's word", () => {
		expect(joinNames([], "and")).toBe("");
		expect(joinNames(["Noor"], "and")).toBe("Noor");
		expect(joinNames(["Noor", "Lotte"], "en")).toBe("Noor en Lotte");
		expect(joinNames(["A", "B", "C"], "and")).toBe("A, B and C");
	});
});

describe("review fixes", () => {
	it("gives a check started while paused its full time on resume", () => {
		const running = go(started(), "sam", 0);
		const paused = pause(running, 10_000);
		const left = leave(paused, "sam", 11_000);
		expect(left.phase).toBe("checking");
		expect(left.pausedRemaining).toBe(CLOCK_CHECK_MS);
		expect(resume(left, 50_000).deadline).toBe(50_000 + CLOCK_CHECK_MS);
	});

	it("clears the paused clock when the host skips a paused turn", () => {
		const paused = pause(go(started(), "sam", 0), 10_000);
		const skipped = skipTurn(paused, 11_000);
		expect(skipped.phase).toBe("ready");
		expect(skipped.pausedRemaining).toBeUndefined();
		expect(resume(skipped, 20_000).deadline).toBeUndefined();
	});

	it("counts switches already asked for, so a team can't drop below two", () => {
		let state = createClockState(SETTINGS);
		for (const [id, team] of [
			["sam", 0],
			["noor", 0],
			["lotte", 0],
			["daan", 1],
			["mila", 1],
			["ivo", 1],
		] as const) {
			state = pickTeam(state, id, team);
		}
		state = startGame(
			state,
			["sam", "noor", "lotte", "daan", "mila", "ivo"],
			PACK,
			mulberry32(1),
			0,
		);
		const describer = state.turn?.describerId;
		const [a, b] = teamMembers(state, 1)
			.map((m) => m.participantId)
			.filter((id) => id !== describer);
		const first = pickTeam(state, a as string, 0);
		expectCode(() => pickTeam(first, b as string, 0), "clockSwitchBlocked");
	});
});

describe("changing a pending switch", () => {
	it("lets a player retarget a switch they already asked for", () => {
		let state = createClockState({ ...SETTINGS, teamCount: 3 });
		const roster = [
			["sam", 0],
			["noor", 0],
			["lotte", 0],
			["daan", 1],
			["mila", 1],
			["ivo", 2],
			["bo", 2],
		] as const;
		for (const [id, team] of roster) state = pickTeam(state, id, team);
		state = startGame(
			state,
			roster.map(([id]) => id),
			PACK,
			mulberry32(1),
			0,
		);
		const describer = state.turn?.describerId;
		const mover = teamMembers(state, 0)
			.map((m) => m.participantId)
			.find((id) => id !== describer) as string;
		const toB = pickTeam(state, mover, 1);
		const toC = pickTeam(toB, mover, 2);
		expect(
			toC.members.find((m) => m.participantId === mover)?.pendingTeam,
		).toBe(2);
	});
});

describe("a short last team", () => {
	it("closes the round instead of waiting on a Next nobody gets", () => {
		let state = createClockState({ ...SETTINGS, teamCount: 3 });
		const roster = [
			["sam", 0],
			["noor", 0],
			["daan", 1],
			["mila", 1],
			["ivo", 2],
			["bo", 2],
		] as const;
		for (const [id, team] of roster) state = pickTeam(state, id, team);
		state = startGame(
			state,
			roster.map(([id]) => id),
			PACK,
			mulberry32(1),
			0,
		);
		// Comets play, then Rockets; Meteors lose a player before Rockets score.
		state = playTurn(state, 1);
		state = nextTurn(state, upcomingTurn(state)?.describerId as string, 2000);
		state = leave(state, "bo", 2500);
		state = playTurn(state, 2, 3000);
		expect(state.phase).toBe("score");
		expect(state.round).toBe(2);
		expect(upcomingTurn(state)?.team).toBe(0);
	});
});

describe("a guesser leaving on the ready screen", () => {
	it("skips the team when it drops below two, whoever leaves", () => {
		let state = createClockState({ ...SETTINGS, teamCount: 3 });
		const roster = [
			["a", 0],
			["b", 0],
			["c", 1],
			["d", 1],
			["e", 2],
			["f", 2],
		] as const;
		for (const [id, team] of roster) state = pickTeam(state, id, team);
		state = startGame(
			state,
			roster.map(([id]) => id),
			PACK,
			mulberry32(3),
			0,
		);
		const turn = state.turn as NonNullable<ClockState["turn"]>;
		const guesser = teamMembers(state, turn.team)
			.map((m) => m.participantId)
			.find((id) => id !== turn.describerId) as string;
		const after = leave(state, guesser, 500);
		expect(after.phase).toBe("ready");
		expect(after.turn?.team).not.toBe(turn.team);
		expect(after.notice).toEqual({
			kind: "skippedShort",
			team: turn.team,
			at: 500,
		});
	});
});
