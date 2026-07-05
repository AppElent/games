import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { SignalWordsRoom } from "#/components/signal-words/SignalWordsRoom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/signal-words/$sessionId")({
	component: SignalWordsSessionPage,
	staticData: { fullscreen: true },
});

function SignalWordsSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.signalWords.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<FullscreenGamePage title="Signal Words" className="text-slate-300">
				Loading room...
			</FullscreenGamePage>
		);
	}
	if (bundle === null) {
		return (
			<FullscreenGamePage title="Signal Words" className="text-orange-200">
				Room not found.
			</FullscreenGamePage>
		);
	}

	const joinUrl = bundle.session.joinCode
		? `${window.location.origin}/join?code=${bundle.session.joinCode}`
		: window.location.href;

	return (
		<FullscreenGamePage title="Signal Words" maxWidthClassName="max-w-5xl">
			<SignalWordsRoom bundle={bundle} joinUrl={joinUrl} />
		</FullscreenGamePage>
	);
}
