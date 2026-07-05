import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HitsterHostView } from "#/components/hitster/HitsterHostView";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/hitster/$sessionId/host")({
	component: HitsterHostPage,
	staticData: { fullscreen: true },
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
			<FullscreenGamePage title="Hitster" className="text-[var(--club-muted)]">
				Loading room...
			</FullscreenGamePage>
		);
	}
	if (bundle === null || !participantId) {
		return (
			<FullscreenGamePage title="Hitster" className="text-orange-500">
				{bundle === null
					? "Room not found."
					: "Host session expired. Create a new room."}
			</FullscreenGamePage>
		);
	}
	return (
		<FullscreenGamePage title="Hitster" maxWidthClassName="max-w-5xl">
			<HitsterHostView
				bundle={bundle}
				participantId={participantId as Id<"sessionParticipants">}
			/>
		</FullscreenGamePage>
	);
}
