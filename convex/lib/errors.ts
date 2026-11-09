import {
	type GameErrorCode,
	type GameErrorData,
	type GameErrorParams,
	GameRuleError,
} from "@arcadeclub/core/errors";
import { ConvexError } from "convex/values";

/**
 * A player-facing error. Clients localize `code` from
 * `messages.serverErrors`; never throw English text from a function.
 */
export function gameError(code: GameErrorCode, params?: GameErrorParams) {
	const data: GameErrorData = params ? { code, params } : { code };
	return new ConvexError(data);
}

/** Runs shared rules, turning a rule violation into a keyed error. */
export function rules<T>(apply: () => T): T {
	try {
		return apply();
	} catch (caught) {
		throw caught instanceof GameRuleError
			? gameError(caught.code, caught.params)
			: caught;
	}
}
