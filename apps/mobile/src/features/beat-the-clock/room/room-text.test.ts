import {
	createClockState,
	pickTeam,
	startGame,
} from "@arcadeclub/core/beat-the-clock";
import {
	type ClockPublicState,
	clockView,
} from "@arcadeclub/core/beat-the-clock-view";
import { en } from "@arcadeclub/core/i18n/en/index";
import { mulberry32 } from "@arcadeclub/core/random";
import { clockMeta, liveTurn, teamAfterSkip, teamNames } from "./room-text";

const copy = en.games.beatTheClock;
const PLAYERS = ["a", "b", "c", "d"];

function publicState(started: boolean): ClockPublicState {
	let state = createClockState({
		packId: "everyday",
		locale: "en",
		turnSeconds: 30,
		target: 20,
		teamCount: 2,
	});
	PLAYERS.forEach((id, index) => {
		state = pickTeam(state, id, index % 2);
	});
	if (started) state = startGame(state, PLAYERS, 200, mulberry32(1), 0);
	const { deck: _deck, used: _used, turn, ...rest } = state;
	return {
		...rest,
		turn: turn ? { ...turn, words: undefined } : undefined,
		deckLeft: 100,
		packWillRunLow: false,
	};
}

const participants = PLAYERS.map((id) => ({
	_id: id,
	displayName: id,
	role: "player",
}));

describe("room text", () => {
	it("joins team names in the copy's language", () => {
		expect(teamNames(copy).list([0, 1, 2])).toBe("Comets, Rockets and Meteors");
	});

	it("describes the lobby, then the turn", () => {
		const lobby = publicState(false);
		expect(clockMeta(lobby, "lobby", copy)).toBe("30 s · first to 20");
		const playing = publicState(true);
		expect(clockMeta(playing, "turn", copy)).toBe("Turn 1 · first to 20");
		expect(liveTurn(playing)).toBe(true);
	});

	it("hands a skipped turn to the next team", () => {
		const playing = publicState(true);
		const view = clockView(playing, participants, "a", "a", 0);
		const team = playing.turn?.team ?? 0;
		expect(teamAfterSkip(playing, view)).toBe((team + 1) % 2);
		const lobby = publicState(false);
		expect(
			teamAfterSkip(lobby, clockView(lobby, participants, "a", "a", 0)),
		).toBeUndefined();
	});
});
