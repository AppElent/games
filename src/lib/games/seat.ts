import { useEffect, useState } from "react";
import {
	readTabValue,
	removeTabValue,
	writeTabValue,
} from "#/lib/games/local-store";
import type { Id } from "../../../convex/_generated/dataModel";

type ParticipantId = Id<"sessionParticipants">;

/**
 * Which participant this tab is, per session. sessionStorage, so a second tab
 * can join the same game as someone else; blocked storage leaves the tab
 * unseated instead of failing the create or join that remembered it. Card
 * games also keep a longer-lived seat secret: see `card-seat.ts`.
 */
const keyOf = (sessionId: string) => `arcade-club.seat.${sessionId}`;

/**
 * One-shot carry-over: before per-session seats a tab kept one global seat, the
 * host's first. A tab open across that deploy moves it to the session it is on.
 * sessionStorage dies with the tab, so remove after 2026-12-01.
 */
const LEGACY_SEAT_KEYS = [
	"arcade-club.hostParticipantId",
	"arcade-club.participantId",
];

function readSeat(sessionId: string): string | null {
	const stored = readTabValue(keyOf(sessionId));
	if (stored) return stored;
	const legacy = LEGACY_SEAT_KEYS.map(readTabValue).find(Boolean) ?? null;
	if (legacy) {
		writeTabValue(keyOf(sessionId), legacy);
		for (const key of LEGACY_SEAT_KEYS) removeTabValue(key);
	}
	return legacy;
}

export function rememberSeat(sessionId: string, participantId: ParticipantId) {
	writeTabValue(keyOf(sessionId), participantId);
}

/** Unset on the first render, so server and client render the same markup. */
export function useSeat(sessionId: string): ParticipantId | undefined {
	const [seat, setSeat] = useState<ParticipantId>();
	useEffect(() => {
		const stored = readSeat(sessionId);
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
