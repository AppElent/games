/**
 * Errors that reach players carry a message key, not English text. The
 * server throws `ConvexError<GameErrorData>` (see `convex/lib/errors.ts`),
 * shared rules throw `GameRuleError`, and clients resolve either against
 * `messages.serverErrors` with `gameErrorMessage`.
 */
import type { Messages } from "./i18n/en";
import { fmt } from "./i18n/format";

export type GameErrorCode = keyof Messages["serverErrors"];
export type GameErrorParams = Record<string, string | number>;
export type GameErrorData = { code: GameErrorCode; params?: GameErrorParams };

/** A rule violation in shared game logic, safe to show once localized. */
export class GameRuleError extends Error {
	readonly code: GameErrorCode;
	readonly params?: GameErrorParams;

	constructor(code: GameErrorCode, params?: GameErrorParams) {
		super(code);
		this.name = "GameRuleError";
		this.code = code;
		this.params = params;
	}
}

function isGameErrorData(value: unknown): value is GameErrorData {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { code?: unknown }).code === "string"
	);
}

/** The keyed error inside a caught value: a `GameRuleError` or a `ConvexError` whose data is `GameErrorData`. */
export function gameErrorData(caught: unknown): GameErrorData | null {
	if (caught instanceof GameRuleError) {
		return { code: caught.code, params: caught.params };
	}
	const data = (caught as { data?: unknown } | null)?.data;
	return isGameErrorData(data) ? data : null;
}

/**
 * Localized text for a caught error. Anything without a known code (network
 * failures, server crashes, internal invariants) shows `fallback`, so raw
 * server text never reaches the UI.
 */
export function gameErrorMessage(
	messages: Pick<Messages, "serverErrors">,
	caught: unknown,
	fallback: string,
): string {
	const data = gameErrorData(caught);
	const template = data ? messages.serverErrors[data.code] : undefined;
	if (!data || typeof template !== "string") return fallback;
	return fmt(template, data.params ?? {});
}
