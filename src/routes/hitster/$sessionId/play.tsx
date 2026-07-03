import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { HitsterStage } from "#/components/hitster/HitsterStage";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/hitster/$sessionId/play")({
	validateSearch: (search) => ({
		participantId:
			typeof search.participantId === "string" ? search.participantId : "",
	}),
	component: HitsterPlayerPage,
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
			<main className="club-wrap py-10 text-[var(--club-muted)]">
				Loading game...
			</main>
		);
	}
	if (bundle === null) {
		return (
			<main className="club-wrap py-10 text-orange-500">Game not found.</main>
		);
	}
	if (!participantId) {
		return (
			<main className="club-wrap py-10 text-orange-500">
				Join this room with its code from the home page first.
			</main>
		);
	}
	return (
		<main className="club-wrap py-6">
			<p className="club-kicker mb-2">Music Timeline</p>
			<HitsterStage
				bundle={bundle}
				participantId={participantId as Id<"sessionParticipants">}
			/>
		</main>
	);
}
