/**
 * This phone's view of a table: the seat it holds, the live state, and every
 * move it can make. Reopening takes the same seat back, so a game survives a
 * restart.
 */
import type { CardAction } from "@arcadeclub/core/cards/engine";
import { gameErrorData, gameErrorMessage } from "@arcadeclub/core/errors";
import { useConvexAuth, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { readGuestIdentity } from "../../players/identity/use-player-identity";
import { findSeat, forgetSeat, type Seat } from "../../sessions/session-seats";

export type CardTableBundle = NonNullable<
	FunctionReturnType<typeof api.cardGames.getTable>
>;

const HEARTBEAT_MS = 20_000;
const ERROR_VISIBLE_MS = 4_000;

/** This phone's seat at the table, with the secret that proves it. */
type CardSeat = Seat & { seatSecret: string };

function storedSeat(sessionId: string): CardSeat | null {
	const seat = findSeat(sessionId);
	return seat?.seatSecret
		? {
				sessionId: seat.sessionId,
				participantId: seat.participantId,
				seatSecret: seat.seatSecret,
			}
		: null;
}

export function useCardTable(sessionId: string) {
	const id = sessionId as Id<"gameSessions">;
	const { t } = useI18n();
	const cards = t.games.cards;
	const [seat, setSeat] = useState(() => storedSeat(sessionId));
	const [seatSettled, setSeatSettled] = useState(seat === null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const errorTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const inFlight = useRef(false);

	const table = useQuery(api.cardGames.getTable, {
		sessionId: id,
		participantId: seat?.participantId,
		seatSecret: seat?.seatSecret,
	});
	const tableExists = Boolean(table);
	// The secret settles a guest's seat straight away. An account-held seat waits
	// for this, so failing before it's known costs nothing and is tried again.
	const { isLoading: authLoading } = useConvexAuth();

	const takeSeat = useMutation(api.cardGames.takeSeat);
	const heartbeat = useMutation(api.sessions.heartbeat);
	const actMutation = useMutation(api.cardGames.act);
	const addBotMutation = useMutation(api.cardGames.addBot);
	const removeSeatMutation = useMutation(api.cardGames.removeSeat);
	const startMutation = useMutation(api.cardGames.start);
	const rematchMutation = useMutation(api.cardGames.rematch);
	const autopilotMutation = useMutation(api.cardGames.setAutopilot);

	const participantId = seat?.participantId;
	const seatSecret = seat?.seatSecret;

	const showError = useCallback((message: string) => {
		setError(message);
		haptics.actionFailed();
		clearTimeout(errorTimer.current);
		errorTimer.current = setTimeout(() => setError(""), ERROR_VISIBLE_MS);
	}, []);

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
					showError(cards.lobby.seatError);
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
		cards.lobby.seatError,
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
		move: (seated: NonNullable<typeof seat>) => Promise<unknown>,
		fallback: string,
	) {
		if (seat) void run(() => move(seat), fallback);
	}

	return {
		table,
		loading: table === undefined || (tableExists && !seatSettled),
		pending,
		error,
		act: (action: CardAction) =>
			withSeat(
				(seated) => actMutation({ ...seated, action }),
				cards.table.actionFailed,
			),
		addBot: () => withSeat(addBotMutation, cards.lobby.couldNotChange),
		removeSeat: (index: number) =>
			withSeat(
				(seated) => removeSeatMutation({ ...seated, seat: index }),
				cards.lobby.couldNotChange,
			),
		start: () => withSeat(startMutation, cards.lobby.couldNotStart),
		rematch: () => withSeat(rematchMutation, cards.lobby.couldNotStart),
		setAutopilot: (index: number, on: boolean) =>
			withSeat(
				(seated) => autopilotMutation({ ...seated, seat: index, on }),
				cards.table.actionFailed,
			),
	};
}

export type CardTableControls = ReturnType<typeof useCardTable>;
