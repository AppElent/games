/**
 * Clerk delivers webhooks through Svix. A request is genuine when one of the
 * `v1` signatures in `svix-signature` is the HMAC-SHA256 of
 * `${svix-id}.${svix-timestamp}.${body}` under the endpoint's signing secret
 * (`whsec_` and base64), and its timestamp is within five minutes of now, so
 * a captured request cannot be replayed later.
 * https://docs.svix.com/receiving/verifying-payloads/how-manual
 */

/** How far a delivery's timestamp may be from now, either way. */
export const SIGNATURE_TOLERANCE_MS = 5 * 60_000;

export type Verdict =
	| { ok: true; payload: unknown }
	| { ok: false; status: 400 | 401; reason: string };

const encoder = new TextEncoder();

function decodeBase64(value: string) {
	try {
		return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
	} catch {
		return null;
	}
}

/**
 * The HMAC key of a `whsec_` signing secret. Throws on a malformed secret:
 * that is the deployment's misconfiguration, not the caller's fault.
 */
export async function signingKey(secret: string) {
	const bytes = decodeBase64(secret.replace(/^whsec_/, ""));
	if (!bytes || bytes.length === 0) {
		throw new Error("CLERK_WEBHOOK_SECRET is not a Svix signing secret");
	}
	return await crypto.subtle.importKey(
		"raw",
		bytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);
}

/** Checks a delivery's signature headers against its raw body. */
export async function verifyDelivery(
	headers: Headers,
	body: string,
	key: CryptoKey,
	now: number,
): Promise<Verdict> {
	const id = headers.get("svix-id");
	const timestamp = headers.get("svix-timestamp");
	const signatures = headers.get("svix-signature");
	if (!id || !timestamp || !signatures) {
		return { ok: false, status: 400, reason: "Missing signature headers" };
	}
	const seconds = Number(timestamp);
	if (
		!/^\d+$/.test(timestamp) ||
		Math.abs(now - seconds * 1000) > SIGNATURE_TOLERANCE_MS
	) {
		return { ok: false, status: 401, reason: "Stale or invalid timestamp" };
	}
	const signed = encoder.encode(`${id}.${timestamp}.${body}`);
	for (const entry of signatures.split(" ")) {
		const [version, signature] = entry.split(",", 2);
		if (version !== "v1" || !signature) continue;
		const bytes = decodeBase64(signature);
		// `verify` compares in constant time.
		if (bytes && (await crypto.subtle.verify("HMAC", key, bytes, signed))) {
			try {
				return { ok: true, payload: JSON.parse(body) };
			} catch {
				return { ok: false, status: 400, reason: "Body is not JSON" };
			}
		}
	}
	return { ok: false, status: 401, reason: "Invalid signature" };
}

export type ClerkEvent =
	/** `user.deleted`: purge the account whose Convex `subject` is `userId`. */
	| { kind: "userDeleted"; userId: string }
	/** Any other event type: acknowledged, nothing to do. */
	| { kind: "ignored" }
	/** Signed, but not the shape Clerk sends. */
	| { kind: "malformed" };

/** What a verified delivery asks of this app. */
export function readEvent(payload: unknown): ClerkEvent {
	if (typeof payload !== "object" || payload === null) {
		return { kind: "malformed" };
	}
	const { type, data } = payload as { type?: unknown; data?: unknown };
	if (typeof type !== "string") return { kind: "malformed" };
	if (type !== "user.deleted") return { kind: "ignored" };
	const id =
		typeof data === "object" && data !== null
			? (data as { id?: unknown }).id
			: undefined;
	return typeof id === "string" && id.length > 0
		? { kind: "userDeleted", userId: id }
		: { kind: "malformed" };
}
