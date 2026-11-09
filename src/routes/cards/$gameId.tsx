import { isCardGameId } from "@arcadeclub/core/cards/engine";
import { createFileRoute } from "@tanstack/react-router";
import { CardSetup } from "#/components/cards/CardSetup";
import { CardsNotFound, CardsPage } from "#/components/cards/Chrome";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/cards/$gameId")({
	component: CardSetupPage,
	staticData: { fullscreen: true },
});

function CardSetupPage() {
	const { gameId } = Route.useParams();
	const cards = useMessages().games.cards;
	if (!isCardGameId(gameId)) {
		return (
			<CardsPage
				title={cards.hub.kicker}
				felt="midnight"
				crumbs={[{ label: cards.hub.kicker, to: "/cards" }, { label: gameId }]}
			>
				<CardsNotFound heading={cards.session.unknownGame} />
			</CardsPage>
		);
	}
	return <CardSetup gameId={gameId} />;
}
