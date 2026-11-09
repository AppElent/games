import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { NewGamePage } from "#/components/games/NewGamePage";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/connect-four/new")({
	component: ConnectFourNewPage,
	staticData: { fullscreen: true },
});

function ConnectFourNewPage() {
	const text = useMessages().games.connectFour.newGame;
	return (
		<NewGamePage
			gameType="connect-four"
			create={useMutation(api.connectFour.create)}
			heading={text.heading}
			description={text.instructions}
			createLabel={text.createChallengeLink}
			creatingLabel={text.creatingChallenge}
			errorFallback={text.createChallengeError}
		/>
	);
}
