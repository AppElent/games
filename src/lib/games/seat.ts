import { useEffect, useState } from "react";
import { readTabValue, writeTabValue } from "#/lib/games/local-store";
import type { Id } from "../../../convex/_generated/dataModel";

type ParticipantId = Id<"sessionParticipants">;

/**
 * Which participant this tab is, per session. sessionStorage, so a second tab
 * can join the same game as someone else; blocked storage leaves the tab
 * unseated instead of failing the create or join that remembered it. Card
 * games also keep a longer-lived seat secret: see `card-seat.ts`.
 */
const keyOf = (sessionId: string) => `arcade-club.seat.${sessionId}`;

export function rememberSeat(sessionId: string, participantId: ParticipantId) {
	writeTabValue(keyOf(sessionId), participantId);
}

/** Unset on the first render, so server and client render the same markup. */
export function useSeat(sessionId: string): ParticipantId | undefined {
	const [seat, setSeat] = useState<ParticipantId>();
	useEffect(() => {
		const stored = readTabValue(keyOf(sessionId));
		setSeat(stored ? (stored as ParticipantId) : undefined);
	}, [sessionId]);
	return seat;
}

/** The `?participantId=` a join link carries, "" when absent. */
export function parseSeatSearch(search: Record<string, unknown>): {
	participantId: ParticipantId | "";
} {
	return {
		participantId:
			typeof search.participantId === "string"
				? (search.participantId as ParticipantId)
				: "",
	};
}
