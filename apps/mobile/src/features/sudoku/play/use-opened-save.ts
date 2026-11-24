/**
 * The save `/sudoku/[id]` opens. `id` is the phone's save id, or the session
 * id of an account puzzle the phone may not hold yet.
 *
 * The phone's copy opens at once when it holds changes the account does not
 * have, or when there is no account to ask. Otherwise the account's version
 * is fetched first, so a puzzle played on the web since opens where the web
 * left it; with no answer in `FETCH_TIMEOUT_MS` (offline), the phone's copy
 * opens instead.
 *
 * Once open, the save stays the one the screen started from, until the sync
 * replaces the phone's copy with a newer board from the account: then that
 * one opens instead.
 *
 * An answer is kept only while the account that asked is still the one
 * signed in. The Convex client already drops a result computed under an
 * earlier token, so this only has to catch Clerk moving on before React
 * re-runs the fetch (the same check as `isCurrent` in
 * `use-sudoku-cloud-sync.ts`).
 */
import { useAuth } from "@clerk/expo";
import { useConvex } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api, type Id } from "../../../convex/api";
import { readGuestIdentity } from "../../players/identity/use-player-identity";
import { useBackendAuthReady } from "../../sessions/use-backend-auth-ready";
import { saveFromBundle } from "../saves/sudoku-cloud-sync";
import {
	findSudokuSaveBySession,
	hasUnsentChanges,
	onSudokuSaveWritten,
	readSudokuSave,
	type SudokuSave,
	storeSyncedSave,
} from "../saves/sudoku-save-store";

const FETCH_TIMEOUT_MS = 4000;

export type OpenedSave =
	| { state: "loading" }
	| { state: "ready"; save: SudokuSave }
	| { state: "missing" }
	| { state: "offline" };

function readLocal(id: string) {
	return readSudokuSave(id) ?? findSudokuSaveBySession(id);
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
	return new Promise<T | "timeout">((resolve, reject) => {
		const timer = setTimeout(() => resolve("timeout"), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

export function useOpenedSave(id: string): OpenedSave {
	const convex = useConvex();
	const { isSignedIn, userId } = useAuth();
	const backend = useBackendAuthReady();
	const signedInAs = useRef(userId);
	signedInAs.current = userId;
	const [opened, setOpened] = useState<OpenedSave>(() => {
		const local = readLocal(id);
		if (
			local &&
			(!isSignedIn || !local.cloud?.sessionId || hasUnsentChanges(local))
		) {
			return { state: "ready", save: local };
		}
		return isSignedIn ? { state: "loading" } : { state: "missing" };
	});
	const waiting = opened.state === "loading";
	const canAsk = backend.ready && Boolean(userId);
	const stillAuthenticating = backend.loading;

	useEffect(() => {
		if (!waiting) return;
		const local = readLocal(id);
		const fallback = (): OpenedSave =>
			local ? { state: "ready", save: local } : { state: "offline" };
		if (!canAsk || !userId) {
			// Convex is still taking the token; once it settles without one,
			// the phone's copy is all there is. Offline it may never settle,
			// so the phone's copy also opens after the same wait as a fetch.
			if (!stillAuthenticating) {
				setOpened(fallback());
				return;
			}
			const timer = setTimeout(() => setOpened(fallback()), FETCH_TIMEOUT_MS);
			return () => clearTimeout(timer);
		}
		let active = true;
		const sessionId = (local?.cloud?.sessionId ?? id) as Id<"gameSessions">;
		const isCurrent = () => active && signedInAs.current === userId;
		// The install's guest id: the server answers a guest's puzzle only to
		// the guest id that started it.
		const { id: guestId } = readGuestIdentity();
		withTimeout(
			convex.query(api.sudoku.getBundle, { sessionId, guestId }),
			FETCH_TIMEOUT_MS,
		)
			.then((bundle) => {
				if (!isCurrent()) return;
				if (bundle === "timeout") return setOpened(fallback());
				if (!bundle) {
					return setOpened(local ? fallback() : { state: "missing" });
				}
				// A move may have landed while the account answered.
				const now = readLocal(id);
				if (now && hasUnsentChanges(now)) {
					return setOpened({ state: "ready", save: now });
				}
				const save = saveFromBundle(bundle, {
					id: now?.id ?? sessionId,
					userId,
					now: Date.now(),
				});
				storeSyncedSave(save);
				setOpened({ state: "ready", save });
			})
			.catch(() => {
				// Not a session id the server knows, or the call failed.
				if (isCurrent()) setOpened(local ? fallback() : { state: "missing" });
			});
		return () => {
			active = false;
		};
	}, [waiting, canAsk, stillAuthenticating, convex, id, userId]);

	useEffect(() => {
		if (opened.state !== "ready") return;
		const { save } = opened;
		const follow = () => {
			const stored = readSudokuSave(save.id);
			const replaced =
				stored?.cloud?.loadedUpdatedAt !== save.cloud?.loadedUpdatedAt;
			if (stored && replaced) setOpened({ state: "ready", save: stored });
		};
		follow();
		return onSudokuSaveWritten((change) => {
			if (change === "sync") follow();
		});
	}, [opened]);

	return opened;
}
