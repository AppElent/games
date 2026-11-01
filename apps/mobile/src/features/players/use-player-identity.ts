/**
 * Who this phone is when it joins or hosts a game.
 *
 * A guest id is created once per install and kept in the synchronous
 * preference store (the web keeps the same shape in localStorage), so a guest
 * who reopens the app reclaims the same participant row and seat. The display
 * name is a phone-local preference: a signed-in player defaults to their
 * Clerk first name, a guest to "Player 123".
 */

import {
	createGuestIdentity,
	type LocalGuestIdentity,
} from "@arcadeclub/core/sessions";
import { useUser } from "@clerk/expo";
import { useCallback, useState } from "react";
import {
	PREFERENCE_KEYS,
	readPreference,
	writePreference,
} from "../../prefs/local-preference";

function isGuestIdentity(value: unknown): value is LocalGuestIdentity {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as LocalGuestIdentity).id === "string" &&
		typeof (value as LocalGuestIdentity).displayName === "string"
	);
}

/** The install's guest identity, created on first read. */
export function readGuestIdentity(): LocalGuestIdentity {
	const raw = readPreference(PREFERENCE_KEYS.guest);
	if (raw) {
		try {
			const parsed: unknown = JSON.parse(raw);
			if (isGuestIdentity(parsed)) return parsed;
		} catch {
			// Corrupt value: replaced below.
		}
	}
	const identity = createGuestIdentity();
	writePreference(PREFERENCE_KEYS.guest, JSON.stringify(identity));
	return identity;
}

export function usePlayerIdentity() {
	const { user } = useUser();
	const [guest] = useState(readGuestIdentity);
	const [savedName, setSavedName] = useState(() =>
		readPreference(PREFERENCE_KEYS.displayName),
	);
	const defaultName = user?.firstName?.trim() || guest.displayName;
	const displayName = savedName?.trim() || defaultName;

	const setDisplayName = useCallback((next: string) => {
		const trimmed = next.trim().slice(0, 32);
		writePreference(PREFERENCE_KEYS.displayName, trimmed);
		setSavedName(trimmed);
	}, []);

	return {
		guestId: guest.id,
		displayName,
		defaultName,
		savedName: savedName ?? "",
		setDisplayName,
		isSignedIn: Boolean(user),
	};
}
