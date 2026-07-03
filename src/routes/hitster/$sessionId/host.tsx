import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { HitsterHostView } from "#/components/hitster/HitsterHostView";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/hitster/$sessionId/host")({
	component: HitsterHostPage,
});

function HitsterHostPage() {
	const { sessionId } = Route.useParams();
	const participantId =
		typeof window !== "undefined"
			? window.sessionStorage.getItem("arcade-club.hostParticipantId")
			: null;
	const bundle = useQuery(api.hitster.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
		participantId: participantId
			? (participantId as Id<"sessionParticipants">)
			: undefined,
	});

	if (bundle === undefined) {
		return (
			<main className="club-wrap py-10 text-[var(--club-muted)]">
				Loading room...
			</main>
		);
	}
	if (bundle === null || !participantId) {
		return (
			<main className="club-wrap py-10 text-orange-500">
				{bundle === null
					? "Room not found."
					: "Host session expired. Create a new room."}
			</main>
		);
	}
	return (
		<main className="club-wrap py-6">
			<HitsterHostView
				bundle={bundle}
				participantId={participantId as Id<"sessionParticipants">}
			/>
		</main>
	);
}
