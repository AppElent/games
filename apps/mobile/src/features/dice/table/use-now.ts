import { useEffect, useState } from "react";

const PRESENCE_TICK_MS = 15_000;

/** The time, refreshed often enough to notice a player going silent. */
export function useNow() {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), PRESENCE_TICK_MS);
		return () => clearInterval(timer);
	}, []);
	return now;
}
