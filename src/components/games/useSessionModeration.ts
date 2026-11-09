import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type ParticipantId = Id<"sessionParticipants">;

/**
 * The quiz host's moderation: lock the room, rename the session, remove a
 * player or hand over hosting. Each call returns the mutation's promise, so the
 * screen decides where its error shows. Undefined until the session has a host.
 */
export function useQuizModeration(
	sessionId: Id<"gameSessions">,
	hostParticipantId: ParticipantId | undefined,
) {
	const setLocked = useMutation(api.sessions.setLocked);
	const rename = useMutation(api.sessions.rename);
	const kickParticipant = useMutation(api.sessions.kickParticipant);
	const transferHost = useMutation(api.sessions.transferHost);

	if (!hostParticipantId) {
		return undefined;
	}
	return {
		setLocked: (locked: boolean) =>
			setLocked({ sessionId, hostParticipantId, locked }),
		rename: (title: string) => rename({ sessionId, hostParticipantId, title }),
		kick: (targetParticipantId: ParticipantId) =>
			kickParticipant({ sessionId, hostParticipantId, targetParticipantId }),
		transferHost: (targetParticipantId: ParticipantId) =>
			transferHost({ sessionId, hostParticipantId, targetParticipantId }),
	};
}

export type QuizModeration = NonNullable<ReturnType<typeof useQuizModeration>>;
