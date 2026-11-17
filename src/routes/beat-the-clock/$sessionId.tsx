import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ClockRoom } from "#/components/beat-the-clock/ClockRoom";
import { useClockActions } from "#/components/beat-the-clock/use-clock-room";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { SessionBundleRoute } from "#/components/games/SessionBundleRoute";
import { sessionInviteUrl } from "#/lib/games/invite";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/beat-the-clock/$sessionId")({
	component: BeatTheClockRoomPage,
	staticData: { fullscreen: true },
});

function BeatTheClockRoomPage() {
	const messages = useMessages();
	const copy = messages.games.beatTheClock;
	const sessionId = Route.useParams().sessionId as Id<"gameSessions">;
	const actions = useClockActions(sessionId);
	const bundle = useQuery(
		api.beatTheClock.getBundle,
		actions.seat
			? {
					sessionId,
					participantId: actions.seat.participantId,
					guestId: actions.seat.guestId,
				}
			: { sessionId },
	);
	// No floating shell menu on any state: the room draws its own header.
	const shell = (text: string) => (
		<FullscreenGamePage title={copy.title} menu={null}>
			<p className="pt-10 text-center text-[var(--club-muted)]">{text}</p>
		</FullscreenGamePage>
	);
	return (
		<SessionBundleRoute
			bundle={bundle}
			shell={shell}
			loading={copy.session.loading}
			notFound={copy.session.notFound}
		>
			{(loaded) => (
				<FullscreenGamePage
					title={copy.title}
					menu={null}
					maxWidthClassName="max-w-none"
					className="!px-0 min-h-full"
				>
					<ClockRoom
						bundle={loaded}
						actions={actions}
						joinUrl={sessionInviteUrl(loaded.session)}
					/>
				</FullscreenGamePage>
			)}
		</SessionBundleRoute>
	);
}
