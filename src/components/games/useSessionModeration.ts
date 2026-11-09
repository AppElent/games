import { useMutation } from "convex/react";
import { useGuestId } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ParticipantId = Id<"sessionParticipants">;

/**
 * A host's moderation of their session: lock the room, rename the session, remove a
 * player or hand over hosting. Each call returns the mutation's promise, so the
 * screen decides where its error shows. Undefined until the session has a host.
 */
export function useSessionModeration(
	sessionId: Id<"gameSessions">,
	hostParticipantId: ParticipantId | undefined,
) {
	const setLocked = useMutation(api.sessions.setLocked);
	const rename = useMutation(api.sessions.rename);
	const kickParticipant = useMutation(api.sessions.kickParticipant);
	const transferHost = useMutation(api.sessions.transferHost);
	const guestId = useGuestId();

	if (!hostParticipantId) {
		return undefined;
	}
	const host = { sessionId, hostParticipantId, guestId };
	return {
		setLocked: (locked: boolean) => setLocked({ ...host, locked }),
		rename: (title: string) => rename({ ...host, title }),
		kick: (targetParticipantId: ParticipantId) =>
			kickParticipant({ ...host, targetParticipantId }),
		transferHost: (targetParticipantId: ParticipantId) =>
			transferHost({ ...host, targetParticipantId }),
	};
}

export type SessionModeration = NonNullable<
	ReturnType<typeof useSessionModeration>
>;
