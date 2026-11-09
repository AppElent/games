/**
 * A Hitster room from this phone's seat: the live bundle (which hides the
 * mystery card and other players' answers until the reveal) and the room's
 * mutations, each reporting failure through one `error` value (the last caught error).
 */
import { useMutation } from "convex/react";
import { api } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useSeatedSession } from "../../sessions/use-seated-session";

export type Answer = {
	dropIndex: number;
	artistGuess?: string;
	titleGuess?: string;
	yearGuess?: number;
};

export function useHitsterRoom(sessionId: string) {
	const { id, seat, run, busy, error } = useSeatedSession(sessionId);
	const bundle = useQuery(api.hitster.getBundle, {
		sessionId: id,
		participantId: seat?.participantId,
	});
	const startMutation = useMutation(api.hitster.start);
	const guessMutation = useMutation(api.hitster.submitGuess);
	const stealMutation = useMutation(api.hitster.submitSteal);
	const revealMutation = useMutation(api.hitster.reveal);
	const nextMutation = useMutation(api.hitster.nextRound);

	return {
		participantId: seat?.participantId,
		loading: bundle === undefined,
		bundle: bundle ?? null,
		busy,
		error,
		start: () => run((seat) => startMutation(seat)),
		reveal: () => run((seat) => revealMutation(seat)),
		nextRound: () => run((seat) => nextMutation(seat)),
		guess: (answer: Answer) =>
			run((seat) => guessMutation({ ...seat, ...answer })),
		steal: (answer: Answer) =>
			run((seat) => stealMutation({ ...seat, ...answer })),
	};
}

export type HitsterRoom = ReturnType<typeof useHitsterRoom>;
