import { ROUND_PAUSE_MS } from "@arcadeclub/core/cards/table-view";
import { useEffect, useRef, useState } from "react";

/**
 * True for a moment after a round settles, so its result can be read before
 * the next round's points are picked. Joining a table mid-round does not pause.
 */
export function useRoundPause(round: number) {
	const seen = useRef(round);
	const [paused, setPaused] = useState(false);
	useEffect(() => {
		if (round === seen.current) {
			return;
		}
		seen.current = round;
		setPaused(true);
		const timer = setTimeout(() => setPaused(false), ROUND_PAUSE_MS);
		return () => clearTimeout(timer);
	}, [round]);
	return paused;
}
