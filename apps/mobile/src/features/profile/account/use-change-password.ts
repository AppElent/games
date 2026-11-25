/**
 * Changes the password. When Clerk first wants a recent sign-in, the verify
 * sheet (`reverify`, for the screen to show) opens: confirming tries the
 * change once more, on the same account and session; cancelling changes
 * nothing. Only an account the sheet can't confirm is told to sign in again.
 */
import {
	assertSameAccount,
	isRecentSignInRefusal,
} from "@arcadeclub/core/account-deletion";
import { passwordUpdate } from "@arcadeclub/core/account-password";
import { GameRuleError } from "@arcadeclub/core/errors";
import { useClerk } from "@clerk/expo";
import { useEffect, useRef, useState } from "react";
import { useReverify } from "../reverify/use-reverify";
import { type PasswordChangeError, passwordChangeError } from "./account-edits";

export function useChangePassword(
	/** Told of a session end that the screen is gone to show. */
	onUnseenEnd?: (ended: unknown) => void,
) {
	const clerk = useClerk();
	const reverify = useReverify(clerk, onUnseenEnd);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<PasswordChangeError | null>(null);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	/** Resolves true once the password is changed. */
	async function changePassword(current: string, next: string) {
		const { user, session } = clerk;
		if (busy || !user || !session) return false;
		const account = { userId: user.id, sessionId: session.id };
		const update = async () => {
			assertSameAccount(clerk, account);
			await clerk.user?.updatePassword(passwordUpdate(current, next));
		};
		setBusy(true);
		setError(null);
		try {
			try {
				await update();
			} catch (refusal) {
				if (!isRecentSignInRefusal(refusal)) throw refusal;
				// The sheet need not ask for what was just typed.
				const outcome = await reverify.verify(account, { password: current });
				if (outcome === "cancelled") return false;
				if (outcome === "unsupported") throw refusal;
				if (outcome === "noSecondFactor") {
					throw new GameRuleError("accountSecondFactorUnsupported");
				}
				await update();
			}
			return true;
		} catch (failure) {
			if (!mounted.current) onUnseenEnd?.(failure);
			setError(passwordChangeError(failure));
			return false;
		} finally {
			setBusy(false);
		}
	}

	return { changePassword, busy, error, reverify };
}
