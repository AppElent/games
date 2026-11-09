import type { CardEvent } from "@arcadeclub/core/cards/events";

/** The newest event number, or null for an empty log. */
export function newestSeq(events: readonly CardEvent[]): number | null {
	return events.at(-1)?.seq ?? null;
}

/** A rematch restarts the event log, so its newest number drops below the last one seen. */
export function logRestarted(newest: number | null, previous: number | null) {
	return newest !== null && previous !== null && newest < previous;
}

/** The events after `previous`; all of them when a rematch restarted the log. */
export function eventsSince(
	events: readonly CardEvent[],
	previous: number,
): readonly CardEvent[] {
	return logRestarted(newestSeq(events), previous)
		? events
		: events.filter((event) => event.seq > previous);
}
