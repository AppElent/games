/**
 * A Beat the Clock room from this phone's seat: the live bundle (the five
 * words arrive only for the describer and the referees while the clock
 * runs) and the room's moves. Each move runs as the seat, reports failure
 * through `error`, and names itself in `pending` while it runs.
 */
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import {
	type SeatArgs,
	useSeatedSession,
} from "../../sessions/use-seated-session";

export type ClockBundle = NonNullable<
	FunctionReturnType<typeof api.beatTheClock.getBundle>
>;

export function useClockRoom(sessionId: string) {
	const { id, seat, run, error } = useSeatedSession(sessionId);
	const bundle = useQuery(api.beatTheClock.getBundle, {
		sessionId: id,
		participantId: seat?.participantId,
		guestId: seat?.guestId,
	});
	const [pending, setPending] = useState<string | null>(null);
	const m = {
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

	/** Resolves to whether the move went through. */
	const act = async (
		key: string,
		send: (seat: SeatArgs) => Promise<unknown>,
	) => {
		if (!seat) return false;
		let ok = false;
		setPending(key);
		await run(async (s) => {
			await send(s);
			ok = true;
		});
		setPending(null);
		return ok;
	};

	return {
		participantId: seat?.participantId ?? null,
		loading: bundle === undefined,
		bundle: bundle ?? null,
		error,
		pending,
		pickTeam: (team: number) =>
			act(`team-${team}`, (s) => m.pickTeam({ ...s, team })),
		shuffleTeams: () => act("shuffle", m.shuffleTeams),
		start: () => act("start", m.start),
		go: () => act("go", m.goTurn),
		tick: (index: number, guessed: boolean) =>
			act(`tick-${index}`, (s) => m.tick({ ...s, index, guessed })),
		send: () => act("send", m.send),
		flag: (index: number, flagged: boolean) =>
			act(`flag-${index}`, (s) => m.flagWord({ ...s, index, flagged })),
		confirm: () => act("confirm", m.confirmCheck),
		next: () => act("next", m.next),
		seeWinner: () => act("seeWinner", m.seeWinner),
		extraRound: () => act("extraRound", m.extraRound),
		skip: () => act("skip", m.skip),
		pause: () => act("pause", m.pause),
		resume: () => act("resume", m.resume),
		end: () => act("end", m.end),
		leave: () => act("leave", m.leave),
		playAgain: (newTeams: boolean) =>
			act(newTeams ? "newTeams" : "playAgain", (s) =>
				m.playAgain({ ...s, newTeams }),
			),
	};
}

export type ClockRoom = ReturnType<typeof useClockRoom>;
