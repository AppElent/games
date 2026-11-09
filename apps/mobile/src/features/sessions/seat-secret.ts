/**
 * A new secret for a card-game seat. The table checks it on every move, so it
 * must be unguessable: participant ids are public.
 */
import { randomUUID } from "expo-crypto";

export function newSeatSecret() {
	return `${randomUUID()}${randomUUID()}`;
}
