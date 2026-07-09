import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HitsterHostView } from "#/components/hitster/HitsterHostView";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/hitster/$sessionId/host")({
	component: HitsterHostPage,
	staticData: { fullscreen: true },
});

function HitsterHostPage() {
	const messages = useMessages();
	const session = messages.games.hitster.session;
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
				{session.loadingRoom}
			</FullscreenGamePage>
		);
	}
	if (bundle === null || !participantId) {
		return (
			<FullscreenGamePage title="Hitster" className="text-orange-500">
				{bundle === null ? session.roomNotFound : session.hostSessionExpired}
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
