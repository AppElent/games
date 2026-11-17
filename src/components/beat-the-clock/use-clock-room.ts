import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useState } from "react";
import type { SeatArgs } from "#/lib/games/use-seat-action";
import { useSeatAction } from "#/lib/games/use-seat-action";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type ClockBundle = NonNullable<
	FunctionReturnType<typeof api.beatTheClock.getBundle>
>;

/**
 * This tab's moves in a Beat the Clock room. Each runs as the tab's seat,
 * reports a localized error through `error`, and marks itself `pending`
 * while it runs so its button can show a spinner in place.
 */
export function useClockActions(sessionId: Id<"gameSessions">) {
	const copy = useMessages().games.beatTheClock;
	const { participantId, seat, error, run } = useSeatAction(sessionId);
	const [pending, setPending] = useState<string | null>(null);
	const mutations = {
		pickTeam: useMutation(api.beatTheClock.pickTeam),
		shuffleTeams: useMutation(api.beatTheClock.shuffleTeams),
		start: useMutation(api.beatTheClock.start),
		goTurn: useMutation(api.beatTheClock.goTurn),
		tick: useMutation(api.beatTheClock.tick),
		send: useMutation(api.beatTheClock.send),
		flagWord: useMutation(api.beatTheClock.flagWord),
		confirmCheck: useMutation(api.beatTheClock.confirmCheck),
		next: useMutation(api.beatTheClock.next),
		seeWinner: useMutation(api.beatTheClock.seeWinner),
		extraRound: useMutation(api.beatTheClock.extraRound),
		skip: useMutation(api.beatTheClock.skip),
		pause: useMutation(api.beatTheClock.pause),
		resume: useMutation(api.beatTheClock.resume),
		end: useMutation(api.beatTheClock.end),
		leave: useMutation(api.beatTheClock.leave),
		playAgain: useMutation(api.beatTheClock.playAgain),
	};

	const act = useCallback(
		async (
			key: string,
			send: (seat: SeatArgs) => Promise<unknown>,
			fallback: string = copy.session.actionError,
		) => {
			if (!seat) return false;
			setPending(key);
			const ok = await run(() => send(seat), fallback);
			setPending(null);
			return ok;
		},
		[seat, run, copy],
	);

	return {
		participantId,
		seat,
		error,
		pending,
		pickTeam: (team: number) =>
			act(`team-${team}`, (s) => mutations.pickTeam({ ...s, team })),
		shuffleTeams: () => act("shuffle", mutations.shuffleTeams),
		start: () => act("start", mutations.start, copy.lobby.startError),
		go: () => act("go", mutations.goTurn),
		tick: (index: number, guessed: boolean) =>
			act(`tick-${index}`, (s) => mutations.tick({ ...s, index, guessed })),
		send: () => act("send", mutations.send),
		flag: (index: number, flagged: boolean) =>
			act(`flag-${index}`, (s) => mutations.flagWord({ ...s, index, flagged })),
		confirm: () => act("confirm", mutations.confirmCheck),
		next: () => act("next", mutations.next),
		seeWinner: () => act("seeWinner", mutations.seeWinner),
		extraRound: () => act("extraRound", mutations.extraRound),
		skip: () => act("skip", mutations.skip),
		pause: () => act("pause", mutations.pause),
		resume: () => act("resume", mutations.resume),
		end: () => act("end", mutations.end),
		leave: () => act("leave", mutations.leave),
		playAgain: (newTeams: boolean) =>
			act(newTeams ? "newTeams" : "playAgain", (s) =>
				mutations.playAgain({ ...s, newTeams }),
			),
	};
}

export type ClockActions = ReturnType<typeof useClockActions>;
