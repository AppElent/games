/**
 * The save `/sudoku/[id]` opens. `id` is the phone's save id, or the session
 * id of an account puzzle the phone may not hold yet.
 *
 * The phone's copy opens at once when it holds changes the account does not
 * have, or when there is no account to ask. Otherwise the account's version
 * is fetched first, so a puzzle played on the web since opens where the web
 * left it; with no answer in `FETCH_TIMEOUT_MS` (offline), the phone's copy
 * opens instead.
 */
import { useAuth } from "@clerk/expo";
import { useConvex } from "convex/react";
import { useEffect, useState } from "react";
import { api, type Id } from "../../../convex/api";
import { useBackendAuthReady } from "../../sessions/use-backend-auth-ready";
import { saveFromBundle } from "../saves/sudoku-cloud-sync";
import {
	findSudokuSaveBySession,
	hasUnsentChanges,
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
			// the phone's copy is all there is.
			if (!stillAuthenticating) setOpened(fallback());
			return;
		}
		let active = true;
		const sessionId = (local?.cloud?.sessionId ?? id) as Id<"gameSessions">;
		withTimeout(
			convex.query(api.sudoku.getBundle, { sessionId }),
			FETCH_TIMEOUT_MS,
		)
			.then((bundle) => {
				if (!active) return;
				if (bundle === "timeout") return setOpened(fallback());
				if (!bundle || bundle.session.hostUserId !== userId) {
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
				if (active) setOpened(local ? fallback() : { state: "missing" });
			});
		return () => {
			active = false;
		};
	}, [waiting, canAsk, stillAuthenticating, convex, id, userId]);

	return opened;
}
