/** Resume checks for an update run at most this often. */
export const RESUME_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Whether resuming the app at `now` should check for an update again. */
export function shouldCheckOnResume(
	lastCheckedAt: number | null,
	now: number,
): boolean {
	return (
		lastCheckedAt === null || now - lastCheckedAt >= RESUME_CHECK_INTERVAL_MS
	);
}
