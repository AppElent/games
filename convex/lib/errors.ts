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

/** Rethrow a shared-rule violation as a keyed error; anything else as is. */
export function toGameError(caught: unknown): unknown {
	return caught instanceof GameRuleError
		? gameError(caught.code, caught.params)
		: caught;
}
