/**
 * An EAS update that has downloaded but not run yet, and the restart that
 * applies it. expo-updates applies a download only on the next cold start,
 * which on a phone that is never force-quit can be weeks; this lets the Play
 * tab offer the restart instead. It never restarts on its own: a reload would
 * drop the player out of a game.
 *
 * Inert in development and in builds without expo-updates enabled.
 */
import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { bestEffort, reportError } from "../observability/report";
import { shouldCheckOnResume } from "./check-policy";

const enabled = !__DEV__ && Updates.isEnabled;

export function useAppUpdate(): { ready: boolean; restart: () => void } {
	const { isUpdatePending } = Updates.useUpdates();
	// expo-updates checks on launch itself, so the first resume check waits.
	const lastCheckedAt = useRef(Date.now());

	useEffect(() => {
		if (!enabled) return;
		const subscription = AppState.addEventListener("change", (state) => {
			const now = Date.now();
			if (
				state !== "active" ||
				!shouldCheckOnResume(lastCheckedAt.current, now)
			)
				return;
			lastCheckedAt.current = now;
			// Offline is normal; the next resume tries again.
			bestEffort(
				Updates.checkForUpdateAsync().then((result) =>
					result.isAvailable ? Updates.fetchUpdateAsync() : undefined,
				),
			);
		});
		return () => subscription.remove();
	}, []);

	return {
		ready: enabled && isUpdatePending,
		restart: () => {
			Updates.reloadAsync().catch(reportError);
		},
	};
}
