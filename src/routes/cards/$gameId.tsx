import { isCardGameId } from "@arcadeclub/core/cards/engine";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CardSetup } from "#/components/cards/CardSetup";
import { CardsPage } from "#/components/cards/Chrome";
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
				<div className="cards-panel mt-10 p-6 text-center">
					<h1 className="cards-title mb-3 text-2xl">
						{cards.session.unknownGame}
					</h1>
					<Link to="/cards" className="btn-gold">
						{cards.session.backToGames}
					</Link>
				</div>
			</CardsPage>
		);
	}
	return <CardSetup gameId={gameId} />;
}
