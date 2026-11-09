import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { NewGamePage } from "#/components/games/NewGamePage";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/signal-words/new")({
	component: SignalWordsNewPage,
	staticData: { fullscreen: true },
});

function SignalWordsNewPage() {
	const text = useMessages().games.signalWords.newGame;
	return (
		<NewGamePage
			gameType="signal-words"
			create={useMutation(api.signalWords.create)}
			heading={text.heading}
			description={text.description}
			createLabel={text.createRoom}
			creatingLabel={text.creatingRoom}
			errorFallback={text.createRoomError}
		/>
	);
}
