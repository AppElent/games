import { fmt } from "./i18n/format";

export const SESSION_STATUSES = [
	"lobby",
	"active",
	"completed",
	"cancelled",
] as const;

export const COMPLETED_REASONS = [
	"finished",
	"cancelled",
	"abandoned",
] as const;
export type CompletedReason = (typeof COMPLETED_REASONS)[number];

export const PARTICIPANT_ROLES = ["host", "player", "watcher"] as const;

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

const JOIN_CODE_MAX_LENGTH = 8;

/** The longest code `isJoinCodeLike` accepts, as `formatJoinCode` prints it. */
export const FORMATTED_JOIN_CODE_MAX_LENGTH = JOIN_CODE_MAX_LENGTH + 1;

export function isJoinCodeLike(value: string) {
	const normalized = normalizeJoinCode(value);
	return normalized.length >= 4 && normalized.length <= JOIN_CODE_MAX_LENGTH;
}

/** A guest's name from their id, in the given `common.session.guestName` template. */
export function getGuestDisplayName(guestId: string, template: string) {
	const digits = guestId.replace(/\D/g, "").slice(-3).padStart(3, "0");
	return fmt(template, { number: digits });
}

/** Web Crypto when the runtime has it (browsers, Node, Hermes with a polyfill). */
const runtimeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } })
	.crypto;

export function createGuestIdentity(
	nameTemplate: string,
	now = Date.now(),
): LocalGuestIdentity {
	const suffix = runtimeCrypto?.randomUUID
		? runtimeCrypto.randomUUID().slice(0, 8)
		: Math.floor(Math.random() * 1_000_000)
				.toString()
				.padStart(6, "0");
	const id = `guest_${suffix}`;
	return {
		id,
		displayName: getGuestDisplayName(id, nameTemplate),
		createdAt: now,
	};
}

export type Invite = { token: string } | { code: string };

/** The `/join` link for an invite. Pass `""` as origin for a same-site link. */
export function buildInviteUrl(origin: string, invite: Invite) {
	const base = origin.replace(/\/+$/, "");
	const query =
		"token" in invite
			? `token=${encodeURIComponent(invite.token)}`
			: `code=${encodeURIComponent(invite.code)}`;
	return `${base}/join?${query}`;
}

function queryParam(query: string, name: string) {
	for (const pair of query.split("&")) {
		const [key, value = ""] = pair.split("=");
		if (key !== name) continue;
		try {
			return decodeURIComponent(value.replace(/\+/g, " "));
		} catch {
			return null;
		}
	}
	return null;
}

/**
 * The invite in a scanned QR code or pasted text: a `/join?token=` or
 * `/join?code=` link (web origin or any app scheme), or a bare room code.
 * `null` for anything else.
 */
export function parseInvite(text: string): Invite | null {
	const value = text.trim();
	if (value.includes("://")) {
		const [before, after = ""] = value.split("?", 2);
		if (!/(^|\/)join\/?$/i.test(before)) return null;
		const query = after.split("#", 1)[0];
		const token = queryParam(query, "token");
		if (token) return { token };
		const code = queryParam(query, "code");
		return code && isJoinCodeLike(code)
			? { code: normalizeJoinCode(code) }
			: null;
	}
	return /^[a-z0-9 -]+$/i.test(value) && isJoinCodeLike(value)
		? { code: normalizeJoinCode(value) }
		: null;
}
