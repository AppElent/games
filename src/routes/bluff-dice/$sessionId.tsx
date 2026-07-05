import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BluffDiceRoom } from "#/components/bluff-dice/BluffDiceRoom";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/bluff-dice/$sessionId")({
	component: BluffDiceSessionPage,
	staticData: { fullscreen: true },
});

function BluffDiceSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.bluffDice.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<FullscreenGamePage title="Bluff Dice" className="text-slate-300">
				Loading table...
			</FullscreenGamePage>
		);
	}
	if (bundle === null) {
		return (
			<FullscreenGamePage title="Bluff Dice" className="text-orange-200">
				Table not found.
			</FullscreenGamePage>
		);
	}

	const joinUrl = bundle.session.joinCode
		? `${window.location.origin}/join?code=${bundle.session.joinCode}`
		: window.location.href;

	return (
		<FullscreenGamePage title="Bluff Dice" maxWidthClassName="max-w-5xl">
			<BluffDiceRoom bundle={bundle} joinUrl={joinUrl} />
		</FullscreenGamePage>
	);
}
