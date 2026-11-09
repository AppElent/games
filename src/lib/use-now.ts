import { useEffect, useState } from "react";

/**
 * The current time in ms, refreshed every `intervalMs` while `enabled`. Starts
 * at the mount time and stops ticking (keeping its last value) when disabled.
 */
export function useNow(intervalMs: number, enabled = true): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!enabled) {
			return;
		}
		const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
		return () => window.clearInterval(timer);
	}, [intervalMs, enabled]);
	return now;
}
