/** Resume checks for an update run at most this often. */
export const RESUME_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Whether resuming the app at `now` should check for an update again.
 * `lastCheckedAt` starts at launch, since expo-updates checks then itself.
 */
export function shouldCheckOnResume(lastCheckedAt: number, now: number) {
	return now - lastCheckedAt >= RESUME_CHECK_INTERVAL_MS;
}
