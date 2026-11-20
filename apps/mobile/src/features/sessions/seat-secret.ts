import { createSeatSecret } from "@arcadeclub/core/sessions";
import { randomUUID } from "expo-crypto";

/** A new secret for a table seat; see `createSeatSecret`. */
export function newSeatSecret() {
	return createSeatSecret(randomUUID);
}
