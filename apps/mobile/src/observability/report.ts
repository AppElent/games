import * as Sentry from "@sentry/react-native";

const reported = new WeakSet<object>();

/**
 * Reports a caught value once per thrown object, keeping its stack, or the
 * value itself when something other than an `Error` was thrown. For error
 * boundaries and failed actions, which swallow what the global handler would
 * otherwise see. Never throws; the caller still renders its own error UI.
 */
export function reportError(error: unknown) {
	if (typeof error === "object" && error !== null) {
		if (reported.has(error)) return;
		reported.add(error);
	}
	try {
		Sentry.captureException(error);
	} catch {
		// Reporting must never break the UI path that called it.
	}
}

/**
 * Runs a platform call whose failure changes nothing for the player:
 * haptics on a device without a Taptic Engine, an orientation lock a
 * resizable window refuses, a dismissed share sheet, an offline update
 * check. Resolves either way.
 */
export function bestEffort(promise: Promise<unknown>): Promise<void> {
	return promise.then(
		() => undefined,
		() => undefined,
	);
}
