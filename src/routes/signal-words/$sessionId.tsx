import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	pageShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { SignalWordsRoom } from "#/components/signal-words/SignalWordsRoom";
import { sessionInviteUrl } from "#/lib/games/invite";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/signal-words/$sessionId")({
	component: SignalWordsSessionPage,
	staticData: { fullscreen: true },
});

function SignalWordsSessionPage() {
	const messages = useMessages();
	const title = messages.catalog["signal-words"].title;
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.signalWords.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});
	return (
		<SessionBundleRoute
			bundle={bundle}
			shell={pageShell(title)}
			loading={messages.games.signalWords.session.loading}
			notFound={messages.games.signalWords.session.notFound}
		>
			{(loaded) => (
				<FullscreenGamePage title={title} maxWidthClassName="max-w-5xl">
					<SignalWordsRoom
						bundle={loaded}
						joinUrl={sessionInviteUrl(loaded.session)}
					/>
				</FullscreenGamePage>
			)}
		</SessionBundleRoute>
	);
}
