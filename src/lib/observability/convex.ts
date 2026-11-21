import * as Sentry from "@sentry/react";
import type { ConvexReactClient } from "convex/react";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";

const reported = new WeakSet<Error>();

/**
 * Reports a failed write once, tagged with the Convex function. A
 * `ConvexError` is an expected, keyed outcome (`roomNotFound`) the UI shows,
 * not a bug, so it is left out.
 */
function reportConvexFailure(error: unknown, operation: string) {
	if (error instanceof ConvexError) return;
	const value =
		error instanceof Error ? error : new Error("Non-Error value thrown");
	if (reported.has(value)) return;
	reported.add(value);
	Sentry.captureException(value, { tags: { operation, handled: true } });
}

let hostOnlyReported = false;

/**
 * Reports that a sudoku write was refused with `hostOnly`, once per page
 * load: the caller does not own the puzzle, so every later save fails the
 * same way. The keyed error is expected for the client instrument above and
 * is skipped there; this is the one place it becomes a signal.
 */
export function reportHostOnlyRejection(operation: string) {
	if (hostOnlyReported) return;
	hostOnlyReported = true;
	Sentry.captureMessage("Sudoku write refused: hostOnly", {
		level: "warning",
		tags: { operation, handled: true },
	});
}

/** Instruments the shared client, including writes made through useMutation. */
export function instrumentConvexClient(client: ConvexReactClient) {
	const mutation = client.mutation.bind(client);
	const action = client.action.bind(client);
	client.mutation = async (reference, ...args) => {
		try {
			return await mutation(reference, ...args);
		} catch (error) {
			reportConvexFailure(error, getFunctionName(reference));
			throw error;
		}
	};
	client.action = async (reference, ...args) => {
		try {
			return await action(reference, ...args);
		} catch (error) {
			reportConvexFailure(error, getFunctionName(reference));
			throw error;
		}
	};
	return client;
}
