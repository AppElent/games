/**
 * Creating an online session this phone hosts. The backend requires an
 * account to host anything but solo play, so callers gate on `canHost`
 * (signed in and the Clerk token already on the Convex client).
 *
 * The hook calls the game's own atomic `create` mutation, named in
 * `APP_GAMES`, which opens the session and its game state together and
 * decides the join mode and auth policy; the seat is remembered under that
 * game, with a fresh seat secret when the game's seats need one.
 */
import { seatsCarrySecret } from "@arcadeclub/core/games";
import { useMutation } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { useCallback } from "react";
import { APP_GAMES, type OnlineGameType } from "../../play/app-games";
import { usePlayerIdentity } from "../../players/identity/use-player-identity";
import { newSeatSecret } from "../seat-secret";
import { rememberSeat } from "../session-seats";
import { useBackendAuthReady } from "../use-backend-auth-ready";
import { useSessionAction } from "../use-session-action";

type Create<G extends OnlineGameType> =
	(typeof APP_GAMES)[G]["online"]["create"];

/** The game's `create` arguments besides who hosts and the seat secret. */
type HostOptions<G extends OnlineGameType> = Omit<
	FunctionArgs<Create<G>>,
	"displayName" | "guestId" | "seatSecret"
>;

export function useHostSession<G extends OnlineGameType>(gameType: G) {
	const backendAuth = useBackendAuthReady();
	const { displayName, guestId } = usePlayerIdentity();
	const { run, busy, error } = useSessionAction();
	const mutate = useMutation(APP_GAMES[gameType].online.create);
	// Each game's own args type; TypeScript can't relate the union to `G`.
	const create = mutate as (
		args: FunctionArgs<Create<G>>,
	) => Promise<FunctionReturnType<Create<G>>>;

	const host = useCallback(
		(options: HostOptions<G>) =>
			run(async () => {
				const seatSecret = seatsCarrySecret(gameType)
					? newSeatSecret()
					: undefined;
				const session = await create({
					...options,
					displayName,
					guestId,
					...(seatSecret ? { seatSecret } : {}),
				} as FunctionArgs<Create<G>>);
				rememberSeat({
					sessionId: session.sessionId,
					participantId: session.participantId,
					gameType,
					seatSecret,
				});
				return session;
			}),
		[create, displayName, gameType, guestId, run],
	);

	return {
		host,
		busy: busy || backendAuth.loading,
		error,
		isSignedIn: backendAuth.isSignedIn,
		canHost: backendAuth.ready,
	};
}
