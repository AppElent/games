import { gameErrorData } from "@arcadeclub/core/errors";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type {
	DefaultFunctionArgs,
	FunctionArgs,
	FunctionReference,
	FunctionReturnType,
} from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import { useErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import {
	forgetTableSeat,
	readTableSeat,
	storeTableSeat,
	type TableSeat,
} from "#/lib/games/table-seat";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Creds = {
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
	seatSecret: string;
};
type Mutation<Args extends DefaultFunctionArgs> = FunctionReference<
	"mutation",
	"public",
	Args
>;

/** What `convex/lib/tableGames.ts` gives every table game module. */
export type TableModule = {
	getTable: FunctionReference<
		"query",
		"public",
		{
			sessionId: string;
			participantId?: Id<"sessionParticipants">;
			seatSecret?: string;
		}
	>;
	takeSeat: Mutation<Creds>;
	reclaimSeat: FunctionReference<
		"mutation",
		"public",
		{ sessionId: Id<"gameSessions"> },
		TableSeat | null
	>;
	act: Mutation<Creds & { action: unknown }>;
	addBot: Mutation<Creds>;
	removeSeat: Mutation<Creds & { seat: number }>;
	start: Mutation<Creds>;
	rematch: Mutation<Creds>;
	setAutopilot: Mutation<Creds & { seat: number; on: boolean }>;
};

/** The failure messages a table shows, in the game's own words. */
export type TableGameWords = {
	seatError: string;
	couldNotChange: string;
	couldNotStart: string;
	actionFailed: string;
};

export type TableBundle<M extends TableModule> = NonNullable<
	FunctionReturnType<M["getTable"]>
>;

const HEARTBEAT_MS = 20_000;
const ERROR_VISIBLE_MS = 4_000;

/**
 * This device's view of a table game (cards, dice): the seat it holds, live
 * state, and every move it can make.
 */
export function useTableGame<M extends TableModule>(
	module: M,
	sessionId: Id<"gameSessions">,
	words: TableGameWords,
) {
	const errorMessage = useErrorMessage();
	const [seat, setSeat] = useState<TableSeat | null>(null);
	const [hydrated, setHydrated] = useState(false);
	const [seatSettled, setSeatSettled] = useState(false);
	// Whether this account has asked for its seat back on this device yet.
	const [reclaimed, setReclaimed] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const errorTimer = useRef<number | undefined>(undefined);
	const inFlight = useRef(false);

	useEffect(() => {
		const stored = readTableSeat(sessionId);
		setSeat(stored);
		setSeatSettled(!stored);
		setReclaimed(false);
		setHydrated(true);
	}, [sessionId]);

	const table = useQuery(
		module.getTable as TableModule["getTable"],
		hydrated
			? {
					sessionId,
					participantId: seat?.participantId,
					seatSecret: seat?.seatSecret,
				}
			: "skip",
	) as FunctionReturnType<M["getTable"]> | undefined;
	const tableExists = Boolean(table);
	// The secret settles a guest's seat straight away. An account-held seat waits
	// for this, so failing before it's known costs nothing and is tried again.
	const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
	// A signed-in player with no seat here (a new browser or device, or a
	// stored one turned away) asks once whether their account sits at the table.
	const needsReclaim =
		hydrated && !seat && !reclaimed && (authLoading || isAuthenticated);

	const takeSeat = useMutation(module.takeSeat);
	const reclaimSeat = useMutation(module.reclaimSeat);
	const heartbeat = useMutation(api.sessions.heartbeat);
	const actMutation = useMutation(module.act as TableModule["act"]);
	const addBotMutation = useMutation(module.addBot);
	const removeSeatMutation = useMutation(module.removeSeat);
	const startMutation = useMutation(module.start);
	const rematchMutation = useMutation(module.rematch);
	const autopilotMutation = useMutation(module.setAutopilot);

	const creds: Creds | null = seat
		? {
				sessionId,
				participantId: seat.participantId,
				seatSecret: seat.seatSecret,
			}
		: null;
	const participantId = creds?.participantId;
	const seatSecret = creds?.seatSecret;

	const showError = useCallback((message: string) => {
		setError(message);
		window.clearTimeout(errorTimer.current);
		errorTimer.current = window.setTimeout(
			() => setError(""),
			ERROR_VISIBLE_MS,
		);
	}, []);

	const { seatError } = words;
	useEffect(() => {
		if (!participantId || !seatSecret || !tableExists) {
			return;
		}
		let active = true;
		takeSeat({ sessionId, participantId, seatSecret })
			.catch((caught) => {
				// Turned away or the seat belongs to another device: watch instead.
				// Anything else may pass, and must not cost a guest their seat.
				const code = gameErrorData(caught)?.code;
				if (authLoading && code === "cardsSeatCredential") {
					return;
				}
				if (code === "cardsSeatCredential" || code === "notInGame") {
					forgetTableSeat(sessionId);
				}
				if (active) {
					setSeat(null);
					showError(seatError);
				}
			})
			.finally(() => {
				if (active) {
					setSeatSettled(true);
				}
			});
		return () => {
			active = false;
		};
	}, [
		sessionId,
		participantId,
		seatSecret,
		tableExists,
		authLoading,
		takeSeat,
		showError,
		seatError,
	]);

	useEffect(() => {
		if (!needsReclaim || !tableExists || authLoading) {
			return;
		}
		let active = true;
		reclaimSeat({ sessionId })
			.then((found) => {
				if (active && found) {
					setSeat(storeTableSeat(sessionId, found));
				}
			})
			// Failing to reclaim leaves the player watching, as before.
			.catch(() => {})
			.finally(() => {
				if (active) {
					setReclaimed(true);
				}
			});
		return () => {
			active = false;
		};
	}, [needsReclaim, tableExists, authLoading, sessionId, reclaimSeat]);

	useEffect(() => {
		if (!participantId) {
			return;
		}
		const { id: guestId } = getOrCreateGuestIdentity();
		const beat = () => {
			void heartbeat({ participantId, guestId }).catch(() => {});
		};
		beat();
		const timer = window.setInterval(beat, HEARTBEAT_MS);
		return () => window.clearInterval(timer);
	}, [participantId, heartbeat]);

	useEffect(() => () => window.clearTimeout(errorTimer.current), []);

	async function run(move: () => Promise<unknown>, fallback: string) {
		// One move at a time, so a double tap can't reach the server as two.
		if (inFlight.current) {
			return;
		}
		inFlight.current = true;
		setPending(true);
		setError("");
		try {
			await move();
		} catch (caught) {
			// Someone else dealt the next round or rematch first: nothing went wrong.
			if (gameErrorData(caught)?.code !== "currentGameNotFinished") {
				showError(errorMessage(caught, fallback));
			}
		} finally {
			inFlight.current = false;
			setPending(false);
		}
	}

	function withSeat(
		move: (seated: Creds) => Promise<unknown>,
		fallback: string,
	) {
		if (creds) {
			void run(() => move(creds), fallback);
		}
	}

	return {
		table,
		loading:
			table === undefined || (tableExists && (!seatSettled || needsReclaim)),
		pending,
		error,
		act: (action: FunctionArgs<M["act"]>["action"]) =>
			withSeat(
				(seated) => actMutation({ ...seated, action }),
				words.actionFailed,
			),
		addBot: () => withSeat(addBotMutation, words.couldNotChange),
		removeSeat: (index: number) =>
			withSeat(
				(seated) => removeSeatMutation({ ...seated, seat: index }),
				words.couldNotChange,
			),
		start: () => withSeat(startMutation, words.couldNotStart),
		rematch: () => withSeat(rematchMutation, words.couldNotStart),
		setAutopilot: (index: number, on: boolean) =>
			withSeat(
				(seated) => autopilotMutation({ ...seated, seat: index, on }),
				words.actionFailed,
			),
	};
}

export type TableGameControls<M extends TableModule> = ReturnType<
	typeof useTableGame<M>
>;
