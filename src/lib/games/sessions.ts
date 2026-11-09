import { messages } from "@arcadeclub/core/messages";
import {
	type LocalGuestIdentity,
	resolveGuestIdentity,
} from "@arcadeclub/core/sessions";
import { useEffect, useState } from "react";
import { readJson, writeJson } from "#/lib/games/local-store";

const GUEST_KEY = "arcade-club.guest";

/** This browser's guest, created (or given an unguessable id) on first read. */
export function getOrCreateGuestIdentity() {
	const stored = readJson<LocalGuestIdentity | null>(GUEST_KEY, null);
	const identity = resolveGuestIdentity(
		stored,
		messages.en.common.session.guestName,
		() => crypto.randomUUID(),
	);
	if (identity !== stored) {
		writeJson(GUEST_KEY, identity);
	}
	return identity;
}

/**
 * This browser's guest id, which every call acting for a seat sends: it is a
 * guest's proof that the seat is theirs. Unset on the first render, so server
 * and client render the same markup.
 */
export function useGuestId(): string | undefined {
	const [guestId, setGuestId] = useState<string>();
	useEffect(() => {
		setGuestId(getOrCreateGuestIdentity().id);
	}, []);
	return guestId;
}
