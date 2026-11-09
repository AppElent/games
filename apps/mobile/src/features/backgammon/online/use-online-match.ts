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
	type BackgammonMovePlan,
	type BackgammonTurnState,
	backgammonColorOf,
	isMyTurn,
	shouldAutoEndTurn,
	toTurnState,
} from "@arcadeclub/core/backgammon";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useMemo } from "react";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { useSeatedSession } from "../../sessions/use-seated-session";

type Bundle = NonNullable<FunctionReturnType<typeof api.backgammon.getBundle>>;

/** A match the server has a board for. */
export type LiveMatch = {
	bundle: Bundle;
	state: NonNullable<Bundle["state"]>;
	turn: BackgammonTurnState;
};

export function useOnlineMatch(sessionId: string) {
	const session = useSeatedSession(sessionId);
	const { seat, run } = session;
	const bundle = useQuery(api.backgammon.getBundle, { sessionId: session.id });
	const rollDice = useMutation(api.backgammon.rollDice);
	const applyMove = useMutation(api.backgammon.applyMove);
	const endTurnMutation = useMutation(api.backgammon.endTurn);
	const rematchMutation = useMutation(api.backgammon.rematch);

	const live = useMemo<LiveMatch | null>(() => {
		const state = bundle?.state;
		if (!bundle || !state) return null;
		return { bundle, state, turn: toTurnState(state) };
	}, [bundle]);

	const server = live?.state;
	const myColor =
		(server && backgammonColorOf(server, seat?.participantId)) ?? null;

	const nameOf = useCallback(
		(participant?: Id<"sessionParticipants">) =>
			bundle?.participants.find((entry) => entry._id === participant)
				?.displayName ?? null,
		[bundle?.participants],
	);

	const play = (plan: BackgammonMovePlan, { autoSwitchTurn = false } = {}) => {
		if (!live) return Promise.resolve();
		const after = applyBackgammonPlan(live.turn, plan);
		return run(async (seat) => {
			for (const step of plan.steps) {
				await applyMove({ ...seat, from: step.from, to: step.to });
			}
			if (shouldAutoEndTurn(after, autoSwitchTurn)) {
				await endTurnMutation(seat);
			}
		});
	};

	return {
		loading: bundle === undefined,
		live,
		myColor,
		isMyTurn: server ? isMyTurn(server, myColor) : false,
		nameOf,
		busy: session.busy,
		error: session.error,
		roll: () => run((seat) => rollDice(seat)),
		play,
		endTurn: () => run((seat) => endTurnMutation(seat)),
		rematch: () => run((seat) => rematchMutation(seat)),
	};
}

export type OnlineMatch = ReturnType<typeof useOnlineMatch>;
