import {
	createGuestIdentity,
	type LocalGuestIdentity,
} from "@arcadeclub/core/sessions";

export * from "@arcadeclub/core/sessions";

const GUEST_KEY = "arcade-club.guest";

export function getOrCreateGuestIdentity(storage = window.localStorage) {
	const existing = storage.getItem(GUEST_KEY);
	if (existing) {
		return JSON.parse(existing) as LocalGuestIdentity;
	}
	const identity = createGuestIdentity();
	storage.setItem(GUEST_KEY, JSON.stringify(identity));
	return identity;
}
