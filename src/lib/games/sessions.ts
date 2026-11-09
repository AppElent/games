import { messages } from "@arcadeclub/core/messages";
import {
	createGuestIdentity,
	type LocalGuestIdentity,
} from "@arcadeclub/core/sessions";
import { readJson, writeJson } from "#/lib/games/local-store";

const GUEST_KEY = "arcade-club.guest";

export function getOrCreateGuestIdentity() {
	const existing = readJson<LocalGuestIdentity | null>(GUEST_KEY, null);
	if (existing) {
		return existing;
	}
	const identity = createGuestIdentity(messages.en.common.session.guestName);
	writeJson(GUEST_KEY, identity);
	return identity;
}
