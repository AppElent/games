import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BluffDiceRoom } from "#/components/bluff-dice/BluffDiceRoom";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/bluff-dice/$sessionId")({
	component: BluffDiceSessionPage,
});

function BluffDiceSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.bluffDice.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<main className="club-wrap py-10 text-slate-300">Loading table...</main>
		);
	}
	if (bundle === null) {
		return (
			<main className="club-wrap py-10 text-orange-200">Table not found.</main>
		);
	}

	const joinUrl = bundle.session.joinCode
		? `${window.location.origin}/join?code=${bundle.session.joinCode}`
		: window.location.href;

	return (
		<main className="club-wrap py-6">
			<BluffDiceRoom bundle={bundle} joinUrl={joinUrl} />
		</main>
	);
}
