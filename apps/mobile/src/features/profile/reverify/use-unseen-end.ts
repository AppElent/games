/**
 * An alert for a refusal that arrived after the screen that asked was gone. A
 * real 401 signs the phone out, and the signed-out app can take Delete
 * account or Change password off the screen before the call that hit it
 * answers, leaving no Notice to say why. A native alert outlives the screen.
 */
import { gameErrorData, gameErrorMessage } from "@arcadeclub/core/errors";
import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import { useI18n } from "../../../i18n";

/** Refusals that mean the session is over (or must be renewed) for this task. */
const ENDED = new Set<string>(["accountSessionEnded", "accountSignInFirst"]);

/**
 * A whole-account deletion deleted the data, not the account
 * (`onceDataIsGone`): the person must hear it, whatever stopped the run.
 */
const DATA_GONE = new Set<string>([
	"accountSignInToFinish",
	"accountSecondFactorToFinish",
	"accountDeleteAgain",
]);

export function useUnseenEnd() {
	const { t } = useI18n();
	// The callback outlives the render that made it.
	const latest = useRef(t);
	latest.current = t;
	// Two calls in flight can both end with the session; one alert says it.
	const shown = useRef(false);
	return useCallback((failure: unknown) => {
		// Callers pass it through `asSessionEnd`, so a session that is gone always
		// has a code; a raw refusal left it signed in.
		const code = gameErrorData(failure)?.code;
		if (!code || shown.current) return;
		const dataGone = DATA_GONE.has(code);
		if (!dataGone && !ENDED.has(code)) return;
		shown.current = true;
		const now = latest.current;
		Alert.alert(
			dataGone
				? now.profile.deleteAccount.unfinishedTitle
				: now.profile.reverify.endedTitle,
			gameErrorMessage(now, failure, now.auth.errors.signInAgain),
		);
	}, []);
}
