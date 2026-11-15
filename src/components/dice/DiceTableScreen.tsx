import { getDiceGame } from "@arcadeclub/core/dice/engine";
import { useMessages } from "#/lib/i18n";
import type { Id } from "../../../convex/_generated/dataModel";
import { DiceNotFound, DicePage } from "./Chrome";
import { DiceLobby } from "./Lobby";
import { PushluckTable } from "./PushluckTable";
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
	switch (table.view.family) {
		case "scoresheet":
			return (
				<ScoresheetTable
					game={game}
					table={table}
					view={table.view}
					controls={controls}
				/>
			);
		case "pushluck":
			return (
				<PushluckTable
					game={game}
					table={table}
					view={table.view}
					controls={controls}
				/>
			);
	}
}
