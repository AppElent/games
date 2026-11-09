import type { CardAction } from "@arcadeclub/core/cards/engine";
import { gameErrorData } from "@arcadeclub/core/errors";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type CardSeat,
	forgetCardSeat,
	readCardSeat,
} from "#/lib/games/card-seat";
import { useErrorMessage } from "#/lib/games/errors";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type CardTableBundle = NonNullable<
	FunctionReturnType<typeof api.cardGames.getTable>
>;

const HEARTBEAT_MS = 20_000;
const ERROR_VISIBLE_MS = 4_000;

/** This device's view of a table: the seat it holds, live state, and every move it can make. */
export function useCardTable(sessionId: Id<"gameSessions">) {
	const cards = useMessages().games.cards;
	const errorMessage = useErrorMessage();
	const [seat, setSeat] = useState<CardSeat | null>(null);
	const [hydrated, setHydrated] = useState(false);
	const [seatSettled, setSeatSettled] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const errorTimer = useRef<number | undefined>(undefined);
	const inFlight = useRef(false);

	useEffect(() => {
		const stored = readCardSeat(sessionId);
		setSeat(stored);
		setSeatSettled(!stored);
		setHydrated(true);
	}, [sessionId]);

	const table = useQuery(
		api.cardGames.getTable,
		hydrated
			? {
					sessionId,
					participantId: seat?.participantId,
					seatSecret: seat?.seatSecret,
				}
			: "skip",
	);
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

	const creds = seat
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
					forgetCardSeat(sessionId);
				}
				if (active) {
					setSeat(null);
					showError(cards.lobby.seatError);
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
		cards.lobby.seatError,
	]);

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
		move: (seated: NonNullable<typeof creds>) => Promise<unknown>,
		fallback: string,
	) {
		if (creds) {
			void run(() => move(creds), fallback);
		}
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
