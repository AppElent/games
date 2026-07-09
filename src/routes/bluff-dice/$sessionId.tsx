import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BluffDiceRoom } from "#/components/bluff-dice/BluffDiceRoom";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/bluff-dice/$sessionId")({
	component: BluffDiceSessionPage,
	staticData: { fullscreen: true },
});

function BluffDiceSessionPage() {
	const messages = useMessages();
	const bluffDiceTitle = messages.catalog["bluff-dice"].title;
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.bluffDice.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<FullscreenGamePage title={bluffDiceTitle} className="text-slate-300">
				{messages.games.bluffDice.session.loadingTable}
			</FullscreenGamePage>
		);
	}
	if (bundle === null) {
		return (
			<FullscreenGamePage title={bluffDiceTitle} className="text-orange-200">
				{messages.games.bluffDice.session.tableNotFound}
			</FullscreenGamePage>
		);
	}

	const joinUrl = bundle.session.joinCode
		? `${window.location.origin}/join?code=${bundle.session.joinCode}`
		: window.location.href;

	return (
		<FullscreenGamePage title={bluffDiceTitle} maxWidthClassName="max-w-5xl">
			<BluffDiceRoom bundle={bundle} joinUrl={joinUrl} />
		</FullscreenGamePage>
	);
}
