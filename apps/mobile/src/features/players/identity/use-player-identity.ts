/**
 * Who this phone is when it joins or hosts a game.
 *
 * A guest id is created once per install and kept in the synchronous
 * local store (the web keeps the same shape in localStorage), so a guest
 * who reopens the app reclaims the same participant row and seat. The display
 * name is a phone-local preference: a signed-in player defaults to their
 * Clerk first name, a guest to "Player 123" in the player's language.
 */

import { messages } from "@arcadeclub/core/messages";
import {
	getGuestDisplayName,
	type LocalGuestIdentity,
	resolveGuestIdentity,
} from "@arcadeclub/core/sessions";
import { useUser } from "@clerk/expo";
import { randomUUID } from "expo-crypto";
import { useCallback, useState } from "react";
import { useI18n } from "../../../i18n";
import {
	readJson,
	readText,
	STORAGE_KEYS,
	writeJson,
	writeText,
} from "../../../storage/local-store";

export const PLAYER_NAME_MAX = 32;

function parseGuestIdentity(value: unknown): LocalGuestIdentity | null {
	const guest = value as LocalGuestIdentity | null;
	return typeof guest?.id === "string" && typeof guest.displayName === "string"
		? guest
		: null;
}

/** The guest this run last resolved, for when the store cannot keep it. */
let current: LocalGuestIdentity | null = null;

/**
 * The install's guest identity, created (or given an unguessable id) on first
 * read. Its id proves this phone's guest seats to the server, so a store that
 * will not save it still leaves the run one guest.
 */
export function readGuestIdentity(): LocalGuestIdentity {
	const saved = readJson(STORAGE_KEYS.guest, parseGuestIdentity) ?? current;
	const identity = resolveGuestIdentity(
		saved,
		messages.en.common.session.guestName,
		randomUUID,
	);
	if (identity !== saved) writeJson(STORAGE_KEYS.guest, identity);
	current = identity;
	return identity;
}

export function usePlayerIdentity() {
	const { user } = useUser();
	const { t } = useI18n();
	const [guest] = useState(readGuestIdentity);
	const [savedName, setSavedName] = useState(() =>
		readText(STORAGE_KEYS.displayName),
	);
	const defaultName =
		user?.firstName?.trim() ||
		getGuestDisplayName(guest.id, t.common.session.guestName);
	const displayName = savedName?.trim() || defaultName;

	const setDisplayName = useCallback((next: string) => {
		const trimmed = next.trim().slice(0, PLAYER_NAME_MAX);
		writeText(STORAGE_KEYS.displayName, trimmed);
		setSavedName(trimmed);
	}, []);

	return {
		guestId: guest.id,
		displayName,
		defaultName,
		savedName: savedName ?? "",
		setDisplayName,
	};
}
