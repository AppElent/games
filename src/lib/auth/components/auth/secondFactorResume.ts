import { needsSecondFactor } from "@arcadeclub/core/second-factor";
import { useAuth, useSignIn } from "@clerk/react";
import { useEffect, useRef, useState } from "react";

/**
 * Lets the second step survive a page reload. Clerk keeps the attempt; this
 * tab remembers, until the step closes, which attempt and page it was. Only that attempt is resumed, so one someone else left in the browser
 * is not picked up. Without storage, a reload starts the sign-in over.
 */
const KEY = "arcade-second-factor";

const marker = (id: string) => `${window.location.pathname} ${id}`;

function read() {
	try {
		return sessionStorage.getItem(KEY);
	} catch {
		return null;
	}
}

/** Marks the open step; a reload skips the cleanup, so the mark stays. */
export function useRememberSecondFactor(id: string | undefined) {
	useEffect(() => {
		if (!id) return;
		try {
			sessionStorage.setItem(KEY, marker(id));
		} catch {}
		return () => {
			try {
				sessionStorage.removeItem(KEY);
			} catch {}
		};
	}, [id]);
}

/** Calls `onResume` once when a reload left the step open; true while waiting for Clerk. */
export function useResumeSecondFactor(onResume: () => void): boolean {
	const { signIn } = useSignIn();
	const { isLoaded } = useAuth();
	const [pending, setPending] = useState(false);
	const checked = useRef(false);

	useEffect(() => {
		if (checked.current) return;
		const remembered = read();
		if (!remembered) {
			checked.current = true;
			return;
		}
		// Before Clerk loads, `signIn` is a placeholder.
		setPending(!isLoaded);
		if (!isLoaded) return;
		checked.current = true;
		if (
			signIn.id &&
			remembered === marker(signIn.id) &&
			needsSecondFactor(signIn.status)
		) {
			onResume();
			return;
		}
		try {
			sessionStorage.removeItem(KEY);
		} catch {}
	}, [isLoaded, signIn, onResume]);

	return pending;
}
