import { getDiceGame } from "@arcadeclub/core/dice/engine";
import { useMessages } from "#/lib/i18n";
import type { Id } from "../../../convex/_generated/dataModel";
import { BiddingTable } from "./BiddingTable";
import { DiceNotFound, DicePage } from "./Chrome";
import { DiceLobby } from "./Lobby";
import { ScoresheetTable } from "./ScoresheetTable";
import { useDiceTable } from "./useDiceTable";

/** Picks the screen for a table's state; the rule family picks the table itself. */
export function DiceTableScreen({
	sessionId,
}: {
	sessionId: Id<"gameSessions">;
}) {
	const dice = useMessages().games.dice;
	const controls = useDiceTable(sessionId);
	const { table, loading } = controls;

	if (loading || !table) {
		return (
			<DicePage
				title={dice.hub.kicker}
				felt="midnight"
				crumbs={[
					{ label: dice.hub.kicker, to: "/dice" },
					{ label: dice.table.crumb },
				]}
			>
				{loading ? (
					<p className="mt-10 text-center text-[var(--ivory-muted)]">
						{dice.session.loading}
					</p>
				) : (
					<DiceNotFound heading={dice.session.notFound} />
				)}
			</DicePage>
		);
	}

	const game = getDiceGame(table.gameId);
	if (table.status === "lobby" || !table.view) {
		return <DiceLobby game={game} table={table} controls={controls} />;
	}
	// The game picks the family; its view always comes from the same family.
	const view = table.view;
	if (game.family === "scoresheet" && view.family === "scoresheet") {
		return (
			<ScoresheetTable
				game={game}
				table={table}
				view={view}
				controls={controls}
			/>
		);
	}
	if (game.family === "bidding" && view.family === "bidding") {
		return (
			<BiddingTable game={game} table={table} view={view} controls={controls} />
		);
	}
	return null;
}
