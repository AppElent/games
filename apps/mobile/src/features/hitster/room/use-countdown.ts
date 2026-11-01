import { useEffect, useState } from "react";

/** Seconds left on the turn timer, or null when the round is untimed. */
export function useCountdown(
	seconds: number | undefined,
	startedAt: number | undefined,
	running: boolean,
) {
	const active = Boolean(running && seconds && startedAt);
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		setNow(Date.now());
		const interval = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(interval);
	}, [active]);
	if (!active || !seconds || !startedAt) return null;
	return Math.max(0, seconds - Math.floor((now - startedAt) / 1000));
}
