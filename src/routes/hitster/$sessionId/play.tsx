import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HitsterStage } from "#/components/hitster/HitsterStage";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/hitster/$sessionId/play")({
	validateSearch: (search) => ({
		participantId:
			typeof search.participantId === "string" ? search.participantId : "",
	}),
	component: HitsterPlayerPage,
	staticData: { fullscreen: true },
});

function HitsterPlayerPage() {
	const { sessionId } = Route.useParams();
	const search = Route.useSearch();
	const participantId =
		search.participantId ||
		(typeof window !== "undefined"
			? (window.sessionStorage.getItem("arcade-club.participantId") ?? "")
			: "");
	const bundle = useQuery(api.hitster.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
		participantId: participantId
			? (participantId as Id<"sessionParticipants">)
			: undefined,
	});

	if (bundle === undefined) {
		return (
			<FullscreenGamePage title="Hitster" className="text-[var(--club-muted)]">
				Loading game...
			</FullscreenGamePage>
		);
	}
	if (bundle === null) {
		return (
			<FullscreenGamePage title="Hitster" className="text-orange-500">
				Game not found.
			</FullscreenGamePage>
		);
	}
	if (!participantId) {
		return (
			<FullscreenGamePage title="Hitster" className="text-orange-500">
				Join this room with its code from the home page first.
			</FullscreenGamePage>
		);
	}
	return (
		<FullscreenGamePage title="Hitster" maxWidthClassName="max-w-5xl">
			<p className="club-kicker mb-2">Music Timeline</p>
			<HitsterStage
				bundle={bundle}
				participantId={participantId as Id<"sessionParticipants">}
			/>
		</FullscreenGamePage>
	);
}
