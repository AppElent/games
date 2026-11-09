/**
 * Live state of the online games under "Continue", so a row can say who is
 * playing and whether the game is still open.
 */
import type { FunctionReturnType } from "convex/server";
import { useMemo } from "react";
import { api } from "../../../convex/api";
import { useQueries } from "../../../convex/query-cache";
import type { ContinueItem } from "./continue-items";

type Bundle = FunctionReturnType<typeof api.sessions.getBundle>;

export type OnlineStatus = {
	phase: "lobby" | "active";
	/** Everyone else still in the game, by display name. */
	others: string[];
	joinCode?: string;
};

/**
 * `null` when the game is over or gone, so the row hides; `undefined` while
 * it loads.
 */
export function onlineStatus(
	bundle: Bundle | undefined,
	participantId: string,
): OnlineStatus | null | undefined {
	if (bundle === undefined) return undefined;
	if (!bundle) return null;
	const { session, participants } = bundle;
	if (session.status !== "lobby" && session.status !== "active") return null;
	return {
		phase: session.status,
		others: participants
			.filter((p) => p._id !== participantId && !p.kickedAt)
			.map((p) => p.displayName),
		joinCode: session.joinCode,
	};
}

/** Statuses keyed by item id; saved games have none. */
export function useOnlineStatuses(items: ContinueItem[]) {
	const queries = useMemo(
		() =>
			Object.fromEntries(
				items.flatMap((item) =>
					item.seat
						? [
								[
									item.id,
									{
										query: api.sessions.getBundle,
										args: { sessionId: item.seat.sessionId },
									},
								],
							]
						: [],
				),
			),
		[items],
	);
	const results = useQueries(queries);
	const statuses: Record<string, OnlineStatus | null | undefined> = {};
	for (const item of items) {
		if (!item.seat) continue;
		const result = results[item.id];
		// A failed query (a malformed id from an old build) reads as gone.
		statuses[item.id] =
			result instanceof Error
				? null
				: onlineStatus(result as Bundle | undefined, item.seat.participantId);
	}
	return statuses;
}
