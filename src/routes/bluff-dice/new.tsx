import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { NewGamePage } from "#/components/games/NewGamePage";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/bluff-dice/new")({
	component: BluffDiceNewPage,
	staticData: { fullscreen: true },
});

function BluffDiceNewPage() {
	const text = useMessages().games.bluffDice.new;
	return (
		<NewGamePage
			gameType="bluff-dice"
			create={useMutation(api.bluffDice.create)}
			heading={text.heading}
			description={text.description}
			createLabel={text.createRoomButton}
			creatingLabel={text.creatingRoomButton}
			errorFallback={text.couldNotCreateRoom}
		/>
	);
}
