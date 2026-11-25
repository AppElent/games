/**
 * Deleting from the signed-in account, Arcade Club's data only or the whole
 * AppElent account; the steps and their order live in
 * `@arcadeclub/core/account-deletion`, shared with the web Account page.
 *
 * Clerk deletes an account only after a recent sign-in. The app checks first
 * and, when the sign-in is old, opens the verify sheet (`reverify`, for the
 * screen to show) before anything is deleted; confirming continues the
 * deletion, cancelling deletes nothing. Only an account the sheet can't
 * handle is offered `signInAgain`: the app's own sign-in gives a fresh one,
 * and the app returns to the delete screen afterwards.
 */
import {
	type DeletionScope,
	deleteAccount as runDeletion,
} from "@arcadeclub/core/account-deletion";
import { GameRuleError } from "@arcadeclub/core/errors";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { signOutToReturn } from "../../../auth/return-target";
import { api } from "../../../convex/api";
import { useBackendAuthReady } from "../../sessions/use-backend-auth-ready";
import { useSessionAction } from "../../sessions/use-session-action";
import { asSessionEnd, useReverify } from "../reverify/use-reverify";
import {
	deletionSteps,
	needsSignInAgain,
	onceDataIsGone,
} from "./delete-account-steps";

export function useDeleteAccount(
	/** Told of a session end that the screen is gone to show. */
	onUnseenEnd?: (ended: unknown) => void,
) {
	const { user } = useUser();
	const clerk = useClerk();
	const { signOut } = useAuth();
	const backendAuth = useBackendAuthReady();
	const deleteMyData = useMutation(api.account.deleteMyData);
	/** The data is deleted, the account not yet: failures must say so. */
	const dataGone = useRef(false);
	const inContext = (failure: unknown) =>
		dataGone.current ? onceDataIsGone(failure) : failure;
	const reverify = useReverify(clerk, (ended) =>
		onUnseenEnd?.(inContext(ended)),
	);
	const { run, busy, error, reset } = useSessionAction();
	/** The Clerk instance does not let users delete themselves. */
	const [unavailable, setUnavailable] = useState(false);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	/** Resolves true once the deletion is done and this phone signed out. */
	async function deleteAccount(scope: DeletionScope) {
		if (busy) return false;
		if (user && scope === "account" && !user.deleteSelfEnabled) {
			setUnavailable(true);
			return false;
		}
		setUnavailable(false);
		dataGone.current = false;
		const sessionId = clerk.session?.id;
		if (!user || !sessionId) {
			// Nothing to delete with; a fresh sign-in starts one.
			await run(() => Promise.reject(new GameRuleError("accountSessionEnded")));
			return false;
		}
		const account = { userId: user.id, sessionId };
		return (
			(await run(async () => {
				try {
					return await runDeletion(
						deletionSteps({
							clerk,
							account,
							scope,
							deleteBatch: async () => {
								const batch = await deleteMyData({
									expectedSubject: account.userId,
								});
								dataGone.current = scope === "account" && batch.done;
								return batch;
							},
							reverify: () => reverify.verify(account),
							signOut: () => signOut(),
						}),
					);
				} catch (caught) {
					const failure = inContext(asSessionEnd(clerk, caught));
					// A 401 signs the phone out, which can close this screen first.
					if (!mounted.current) onUnseenEnd?.(failure);
					throw failure;
				}
			})) === true
		);
	}

	return {
		deleteAccount,
		busy,
		/** The verify sheet's state. */
		reverify,
		/** Nobody is signed in: there is nothing to sign out of first. */
		signedOut: !user,
		/** Signed out counts: deleting then says so and offers the sign-in. */
		ready: backendAuth.ready || !backendAuth.isSignedIn,
		error,
		unavailable,
		/** The refusal asks for a fresh sign-in; offer `signInAgain`. */
		needsSignIn: needsSignInAgain(error),
		/**
		 * Signs out so the person can sign in again; deleting after that has a
		 * recent sign-in. The refusal goes, so it doesn't greet the new session.
		 */
		signInAgain: async () => {
			if (!user) return;
			reset();
			await signOutToReturn("/profile/delete-account", user.id, () =>
				signOut(),
			);
		},
	};
}
