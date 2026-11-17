/**
 * The room's header line and the team the host's Skip hands the turn to,
 * worked out from the public state so the screens only render them.
 */

import type {
	ClockPublicState,
	ClockView,
} from "@arcadeclub/core/beat-the-clock-view";
import { fmt, joinNames } from "@arcadeclub/core/i18n/format";

type Copy = {
	teams: readonly string[];
	and: string;
	meta: { turn: string; check: string; roundDone: string };
	lobby: { meta: string };
	winner: { meta: string };
};

export function teamNames(copy: Pick<Copy, "teams" | "and">) {
	return {
		team: (team: number) => copy.teams[team] ?? "",
		list: (teams: readonly number[]) =>
			joinNames(
				teams.map((team) => copy.teams[team] ?? ""),
				copy.and,
			),
		names: (names: readonly string[]) => joinNames(names, copy.and),
	};
}

export function clockMeta(
	state: ClockPublicState,
	screen: ClockView["screen"],
	copy: Copy,
) {
	if (state.phase === "lobby")
		return fmt(copy.lobby.meta, {
			seconds: state.turnSeconds,
			target: state.target,
		});
	if (state.phase === "finished") return copy.winner.meta;
	if (screen === "check")
		return fmt(copy.meta.check, { turn: state.turnNumber });
	if (state.phase === "score" && state.roundOutcome !== "none")
		return fmt(copy.meta.roundDone, {
			round: state.round,
			target: state.target,
		});
	return fmt(copy.meta.turn, { turn: state.turnNumber, target: state.target });
}

/** Whether a turn is live: Go not yet tapped, or the clock running. */
export function liveTurn(state: ClockPublicState) {
	return (
		state.phase === "ready" ||
		state.phase === "describing" ||
		state.phase === "timeUp"
	);
}

/** The team that plays after the host skips, or undefined when Skip isn't offered. */
export function teamAfterSkip(state: ClockPublicState, view: ClockView) {
	const live = liveTurn(state);
	if (!live && !(state.phase === "score" && state.roundOutcome === "none"))
		return undefined;
	const skipped = live ? state.turn?.team : view.upcoming?.team;
	return skipped === undefined ? undefined : (skipped + 1) % state.teamCount;
}
