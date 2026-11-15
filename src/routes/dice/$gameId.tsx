import { isDiceGameId } from "@arcadeclub/core/dice/engine";
import { createFileRoute } from "@tanstack/react-router";
import { DiceNotFound, DicePage } from "#/components/dice/Chrome";
import { DiceSetup } from "#/components/dice/DiceSetup";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/dice/$gameId")({
	component: DiceSetupPage,
	staticData: { fullscreen: true },
});

function DiceSetupPage() {
	const { gameId } = Route.useParams();
	const dice = useMessages().games.dice;
	if (!isDiceGameId(gameId)) {
		return (
			<DicePage
				title={dice.hub.kicker}
				felt="midnight"
				crumbs={[{ label: dice.hub.kicker, to: "/dice" }, { label: gameId }]}
			>
				<DiceNotFound heading={dice.session.unknownGame} />
			</DicePage>
		);
	}
	return <DiceSetup gameId={gameId} />;
}
