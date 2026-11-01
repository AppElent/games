/**
 * An online backgammon match as seen from this phone's seat.
 *
 * The server holds the game; this hook turns its bundle into the engine's
 * turn state and wraps the turn mutations. A combined move is sent one die
 * at a time (the server validates single steps), and the turn ends by
 * itself when every die is spent and auto end-turn is on.
 */
import {
	applyBackgammonPlan,
	type BackgammonColor,
	type BackgammonMovePlan,
	type BackgammonTurnState,
	computeUsedFlags,
	getBackgammonWinner,
} from "@arcadeclub/core/backgammon";
import { useMutation } from "convex/react";
import { useCallback, useMemo, useState } from "react";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { haptics } from "../../../feedback/haptics";
import { findSeat } from "../../sessions/session-seats";

export function useOnlineMatch(sessionId: string, autoSwitchTurn: boolean) {
	const id = sessionId as Id<"gameSessions">;
	const bundle = useQuery(api.backgammon.getBundle, { sessionId: id });
	const [participantId] = useState(
		() =>
			findSeat(sessionId)?.participantId as
				| Id<"sessionParticipants">
				| undefined,
	);
	const rollDice = useMutation(api.backgammon.rollDice);
	const applyMove = useMutation(api.backgammon.applyMove);
	const endTurnMutation = useMutation(api.backgammon.endTurn);
	const rematchMutation = useMutation(api.backgammon.rematch);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const server = bundle?.state ?? null;
	const turn = useMemo<BackgammonTurnState | null>(
		() =>
			server
				? {
						points: server.points,
						bar: server.bar,
						off: server.off,
						activeColor: server.activeColor,
						dice: server.dice,
						used: computeUsedFlags(server.dice, server.usedDice),
					}
				: null,
		[server],
	);

	const myColor: BackgammonColor | null =
		participantId && server
			? server.whiteParticipantId === participantId
				? "white"
				: server.blackParticipantId === participantId
					? "black"
					: null
			: null;

	const nameOf = useCallback(
		(participant?: Id<"sessionParticipants">) =>
			bundle?.participants.find((entry) => entry._id === participant)
				?.displayName ?? null,
		[bundle?.participants],
	);

	const run = useCallback(async (action: () => Promise<unknown>) => {
		setBusy(true);
		setError(null);
		try {
			await action();
			return true;
		} catch (caught) {
			haptics.actionFailed();
			setError(caught);
			return false;
		} finally {
			setBusy(false);
		}
	}, []);

	const seat = participantId ? { sessionId: id, participantId } : null;

	const roll = () =>
		seat ? run(() => rollDice(seat)) : Promise.resolve(false);

	const endTurn = () =>
		seat ? run(() => endTurnMutation(seat)) : Promise.resolve(false);

	const rematch = () =>
		seat ? run(() => rematchMutation(seat)) : Promise.resolve(false);

	const play = (plan: BackgammonMovePlan) => {
		if (!seat || !turn) return Promise.resolve(false);
		const after = applyBackgammonPlan(turn, plan);
		return run(async () => {
			for (const step of plan.steps) {
				await applyMove({ ...seat, from: step.from, to: step.to });
			}
			if (
				autoSwitchTurn &&
				after.used.every(Boolean) &&
				getBackgammonWinner(after.off) === null
			) {
				await endTurnMutation(seat);
			}
		});
	};

	return {
		loading: bundle === undefined,
		bundle,
		turn,
		phase: server?.phase ?? null,
		myColor,
		isMyTurn: Boolean(
			myColor && server?.phase !== "finished" && turn?.activeColor === myColor,
		),
		nameOf,
		busy,
		error,
		roll,
		play,
		endTurn,
		rematch,
	};
}
