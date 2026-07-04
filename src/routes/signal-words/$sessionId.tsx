import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { SignalWordsRoom } from "#/components/signal-words/SignalWordsRoom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/signal-words/$sessionId")({
	component: SignalWordsSessionPage,
});

function SignalWordsSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.signalWords.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<main className="club-wrap py-10 text-slate-300">Loading room...</main>
		);
	}
	if (bundle === null) {
		return (
			<main className="club-wrap py-10 text-orange-200">Room not found.</main>
		);
	}

	const joinUrl = bundle.session.joinCode
		? `${window.location.origin}/join?code=${bundle.session.joinCode}`
		: window.location.href;

	return (
		<main className="club-wrap py-6">
			<SignalWordsRoom bundle={bundle} joinUrl={joinUrl} />
		</main>
	);
}
