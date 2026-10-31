export type LocalGuestIdentity = {
	id: string;
	displayName: string;
	createdAt: number;
};

export function normalizeJoinCode(value: string) {
	return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

export function formatJoinCode(value: string) {
	const normalized = normalizeJoinCode(value);
	if (normalized.length <= 4) {
		return normalized;
	}
	return `${normalized.slice(0, 3)} ${normalized.slice(3)}`;
}

export function isJoinCodeLike(value: string) {
	const normalized = normalizeJoinCode(value);
	return normalized.length >= 4 && normalized.length <= 8;
}

export function getGuestDisplayName(guestId: string) {
	const digits = guestId.replace(/\D/g, "").slice(-3).padStart(3, "0");
	return `Player ${digits}`;
}

/** Web Crypto when the runtime has it (browsers, Node, Hermes with a polyfill). */
const runtimeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
	.crypto;

export function createGuestIdentity(now = Date.now()): LocalGuestIdentity {
	const suffix = runtimeCrypto?.randomUUID
		? runtimeCrypto.randomUUID().slice(0, 8)
		: Math.floor(Math.random() * 1_000_000)
				.toString()
				.padStart(6, "0");
	const id = `guest_${suffix}`;
	return {
		id,
		displayName: getGuestDisplayName(id),
		createdAt: now,
	};
}

export function buildShareUrl(origin: string, token: string) {
	const base = origin.replace(/\/$/, "");
	return `${base}/join?token=${encodeURIComponent(token)}`;
}
