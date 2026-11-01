/**
 * A Hitster room from this phone's seat: the live bundle (which hides the
 * mystery card and other players' answers until the reveal) and the room's
 * mutations, each reporting failure through one `error` value (the last caught error).
 */
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { haptics } from "../../../feedback/haptics";
import { findSeat } from "../../sessions/session-seats";

export type Answer = {
	dropIndex: number;
	artistGuess?: string;
	titleGuess?: string;
	yearGuess?: number;
};

export function useHitsterRoom(sessionId: string) {
	const id = sessionId as Id<"gameSessions">;
	const [participantId] = useState(
		() =>
			findSeat(sessionId)?.participantId as
				| Id<"sessionParticipants">
				| undefined,
	);
	const bundle = useQuery(api.hitster.getBundle, {
		sessionId: id,
		participantId,
	});
	const startMutation = useMutation(api.hitster.start);
	const guessMutation = useMutation(api.hitster.submitGuess);
	const stealMutation = useMutation(api.hitster.submitSteal);
	const revealMutation = useMutation(api.hitster.reveal);
	const nextMutation = useMutation(api.hitster.nextRound);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const run = useCallback(
		async (
			action: (seat: {
				sessionId: Id<"gameSessions">;
				participantId: Id<"sessionParticipants">;
			}) => Promise<unknown>,
		) => {
			if (!participantId) return false;
			setBusy(true);
			setError(null);
			try {
				await action({ sessionId: id, participantId });
				return true;
			} catch (caught) {
				haptics.actionFailed();
				setError(caught);
				return false;
			} finally {
				setBusy(false);
			}
		},
		[id, participantId],
	);

	return {
		participantId,
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
