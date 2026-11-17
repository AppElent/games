import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import {
	readTabValue,
	removeTabValue,
	writeTabValue,
} from "#/lib/games/local-store";
import { useGuestId } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ParticipantId = Id<"sessionParticipants">;

/**
 * Which participant this tab is, per session. sessionStorage, so a second tab
 * can join the same game as someone else; blocked storage leaves the tab
 * unseated instead of failing the create or join that remembered it. A
 * signed-in player's account also finds their seat (`useSeat`). Table games
 * also keep a longer-lived seat secret: see `table-seat.ts`.
 */
const keyOf = (sessionId: string) => `arcade-club.seat.${sessionId}`;

/**
 * One-shot carry-over: before per-session seats a tab kept one global seat. A
 * tab open across that deploy moves it to the session it is on: the joined seat
 * first, since every join overwrote it while a host key stayed behind.
 * sessionStorage dies with the tab, so remove after 2026-12-01.
 */
const LEGACY_SEAT_KEYS = [
	"arcade-club.participantId",
	"arcade-club.hostParticipantId",
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

/** This tab no longer holds a seat in the session (it left the room). */
export function forgetSeat(sessionId: string) {
	removeTabValue(keyOf(sessionId));
}

/**
 * This tab's seat in a session: the one it holds while it is the caller's,
 * else the signed-in account's own (`sessions.ownSeat`), so a player who signs
 * out and back in, or opens a new tab, keeps their seat. Without an answer
 * the held seat stands, as it always did for guests. Unset on the first
 * render, so server and client render the same markup.
 */
export function useSeat(sessionId: string): ParticipantId | undefined {
	const [held, setHeld] = useState<{ sessionId: string; seat?: string }>();
	const guestId = useGuestId();
	useEffect(() => {
		setHeld({ sessionId, seat: readSeat(sessionId) ?? undefined });
	}, [sessionId]);
	const current = held?.sessionId === sessionId ? held : undefined;
	const own = useQuery(
		api.sessions.ownSeat,
		current && guestId
			? {
					sessionId: sessionId as Id<"gameSessions">,
					participantId: current.seat,
					guestId,
				}
			: "skip",
	);
	return own ?? (current?.seat as ParticipantId | undefined);
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
