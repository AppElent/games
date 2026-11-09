import { useEffect, useRef } from "react";

/**
 * Runs `reset` after a commit in which `key` changed. For state that must clear
 * when one value moves on while everything else around it stays: a `key` prop
 * would also remount state that has to survive.
 */
export function useResetOnChange(key: unknown, reset: () => void) {
	const previous = useRef(key);
	const latestReset = useRef(reset);
	latestReset.current = reset;
	useEffect(() => {
		if (previous.current === key) return;
		previous.current = key;
		latestReset.current();
	});
}
