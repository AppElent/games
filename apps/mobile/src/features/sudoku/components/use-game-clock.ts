/**
 * A play clock that only runs while the puzzle is active and the screen is
 * in front. Leaving the screen or the app pauses the puzzle (via `onAway`),
 * so a puzzle left open overnight does not report eight hours of play.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export function useGameClock({
	initialSeconds,
	running,
	onAway,
}: {
	initialSeconds: number;
	running: boolean;
	onAway: () => void;
}) {
	const [elapsed, setElapsed] = useState(initialSeconds);
	const elapsedRef = useRef(elapsed);
	elapsedRef.current = elapsed;
	const awayRef = useRef(onAway);
	awayRef.current = onAway;

	useEffect(() => {
		if (!running) return;
		const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
		return () => clearInterval(timer);
	}, [running]);

	useEffect(() => {
		const listener = AppState.addEventListener("change", (state) => {
			if (state !== "active") awayRef.current();
		});
		return () => listener.remove();
	}, []);

	useFocusEffect(
		useCallback(
			() => () => {
				awayRef.current();
			},
			[],
		),
	);

	return { elapsed, elapsedRef };
}
