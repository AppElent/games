/**
 * An alert for a session that ended after the screen that asked was gone. A
 * real 401 signs the phone out, and the signed-out app can take Delete
 * account or Change password off the screen before the call that hit it
 * answers, leaving no Notice to say why. A native alert outlives the screen.
 */
import { clerkErrorCode } from "@arcadeclub/core/auth-errors";
import { gameErrorData, gameErrorMessage } from "@arcadeclub/core/errors";
import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import { useI18n } from "../../../i18n";
import { SESSION_ENDED } from "./use-reverify";

/** Refusals that mean the session is over (or must be renewed) for this task. */
const ENDED = new Set<string>([
	"accountSessionEnded",
	"accountSignInFirst",
	"accountSignInToFinish",
]);

export function useUnseenEnd() {
	const { t } = useI18n();
	// The callback outlives the render that made it.
	const latest = useRef(t);
	latest.current = t;
	// Two calls in flight can both end with the session; one alert says it.
	const shown = useRef(false);
	return useCallback((failure: unknown) => {
		const code = gameErrorData(failure)?.code;
		// A raw Clerk refusal counts only when the session really is gone: a
		// "reverification required" one leaves it signed in.
		const ended = code
			? ENDED.has(code)
			: SESSION_ENDED.has(clerkErrorCode(failure) ?? "");
		if (!ended || shown.current) return;
		shown.current = true;
		const now = latest.current;
		Alert.alert(
			now.profile.reverify.endedTitle,
			code
				? gameErrorMessage(now, failure, now.auth.errors.signInAgain)
				: now.serverErrors.accountSessionEnded,
		);
	}, []);
}
