import { getCardGame } from "@arcadeclub/core/cards/engine";
import { Link } from "@tanstack/react-router";
import { useMessages } from "#/lib/i18n";
import type { Id } from "../../../convex/_generated/dataModel";
import { CardsPage } from "./Chrome";
import { Lobby } from "./Lobby";
import { RummyTable } from "./RummyTable";
import { SheddingTable } from "./SheddingTable";
import { useCardTable } from "./useCardTable";

/** Picks the screen for a table's state; the rule family picks the table itself. */
export function CardTableScreen({
	sessionId,
}: {
	sessionId: Id<"gameSessions">;
}) {
	const cards = useMessages().games.cards;
	const controls = useCardTable(sessionId);
	const { table, loading } = controls;

	if (loading || !table) {
		return (
			<CardsPage
				title={cards.hub.kicker}
				felt="midnight"
				crumbs={[
					{ label: cards.hub.kicker, to: "/cards" },
					{ label: cards.table.crumb },
				]}
			>
				{loading ? (
					<p className="mt-10 text-center text-[var(--ivory-muted)]">
						{cards.session.loading}
					</p>
				) : (
					<div className="cards-panel mt-10 p-6 text-center">
						<h1 className="cards-title mb-3 text-2xl">
							{cards.session.notFound}
						</h1>
						<Link to="/cards" className="btn-gold">
							{cards.session.backToGames}
						</Link>
					</div>
				)}
			</CardsPage>
		);
	}

	const game = getCardGame(table.gameId);
	if (table.status === "lobby" || !table.view) {
		return <Lobby game={game} table={table} controls={controls} />;
	}
	switch (table.view.family) {
		case "shedding":
			return (
				<SheddingTable
					game={game}
					table={table}
					view={table.view}
					controls={controls}
				/>
			);
		case "rummy":
			return (
				<RummyTable
					game={game}
					table={table}
					view={table.view}
					controls={controls}
				/>
			);
	}
}
