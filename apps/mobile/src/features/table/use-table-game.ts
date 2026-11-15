/**
 * This phone's view of a table game (cards, dice): the seat it holds, the live
 * state, and every move it can make. Reopening takes the same seat back, so a
 * game survives a restart.
 */
import { gameErrorData, gameErrorMessage } from "@arcadeclub/core/errors";
import { useConvexAuth, useMutation } from "convex/react";
import type {
	DefaultFunctionArgs,
	FunctionArgs,
	FunctionReference,
	FunctionReturnType,
} from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Id } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";
import { haptics } from "../../feedback/haptics";
import { useI18n } from "../../i18n";
import { readGuestIdentity } from "../players/identity/use-player-identity";
import { findSeat, forgetSeat, type Seat } from "../sessions/session-seats";

type Creds = Seat & { seatSecret: string };
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

/** This phone's seat at the table, with the secret that proves it. */
function storedSeat(sessionId: string): Creds | null {
	const seat = findSeat(sessionId);
	return seat?.seatSecret
		? {
				sessionId: seat.sessionId,
				participantId: seat.participantId,
				seatSecret: seat.seatSecret,
			}
		: null;
}

export function useTableGame<M extends TableModule>(
	module: M,
	sessionId: string,
	words: TableGameWords,
) {
	const id = sessionId as Id<"gameSessions">;
	const { t } = useI18n();
	const [seat, setSeat] = useState(() => storedSeat(sessionId));
	const [seatSettled, setSeatSettled] = useState(seat === null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const errorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const inFlight = useRef(false);

	const table = useQuery(module.getTable as TableModule["getTable"], {
		sessionId: id,
		participantId: seat?.participantId,
		seatSecret: seat?.seatSecret,
	}) as FunctionReturnType<M["getTable"]> | undefined;
	const tableExists = Boolean(table);
	// The secret settles a guest's seat straight away. An account-held seat waits
	// for this, so failing before it's known costs nothing and is tried again.
	const { isLoading: authLoading } = useConvexAuth();

	const takeSeat = useMutation(module.takeSeat);
	const heartbeat = useMutation(api.sessions.heartbeat);
	const actMutation = useMutation(module.act as TableModule["act"]);
	const addBotMutation = useMutation(module.addBot);
	const removeSeatMutation = useMutation(module.removeSeat);
	const startMutation = useMutation(module.start);
	const rematchMutation = useMutation(module.rematch);
	const autopilotMutation = useMutation(module.setAutopilot);

	const participantId = seat?.participantId;
	const seatSecret = seat?.seatSecret;

	const showError = useCallback((message: string) => {
		setError(message);
		haptics.actionFailed();
		clearTimeout(errorTimer.current);
		errorTimer.current = setTimeout(() => setError(""), ERROR_VISIBLE_MS);
	}, []);

	const { seatError } = words;
	useEffect(() => {
		if (!participantId || !seatSecret || !tableExists) return;
		let active = true;
		takeSeat({ sessionId: id, participantId, seatSecret })
			.catch((caught) => {
				// Turned away or the seat belongs to another device: watch instead.
				// Anything else may pass, and must not cost a guest their seat.
				const code = gameErrorData(caught)?.code;
				if (authLoading && code === "cardsSeatCredential") return;
				if (code === "cardsSeatCredential" || code === "notInGame") {
					forgetSeat(sessionId);
				}
				if (active) {
					setSeat(null);
					showError(seatError);
				}
			})
			.finally(() => {
				if (active) setSeatSettled(true);
			});
		return () => {
			active = false;
		};
	}, [
		id,
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
		if (!participantId) return;
		const { id: guestId } = readGuestIdentity();
		const beat = () => {
			void heartbeat({ participantId, guestId }).catch(() => {});
		};
		beat();
		const timer = setInterval(beat, HEARTBEAT_MS);
		return () => clearInterval(timer);
	}, [participantId, heartbeat]);

	useEffect(() => () => clearTimeout(errorTimer.current), []);

	async function run(move: () => Promise<unknown>, fallback: string) {
		// One move at a time, so a double tap can't reach the server as two.
		if (inFlight.current) return;
		inFlight.current = true;
		setPending(true);
		setError("");
		try {
			await move();
		} catch (caught) {
			// Someone else dealt the next round or rematch first: nothing went wrong.
			if (gameErrorData(caught)?.code !== "currentGameNotFinished") {
				showError(gameErrorMessage(t, caught, fallback));
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
		if (seat) void run(() => move(seat), fallback);
	}

	return {
		table,
		loading: table === undefined || (tableExists && !seatSettled),
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
