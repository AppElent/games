/** Picks the screen for a table's state; the rule family picks the table itself. */
import { getDiceGame } from "@arcadeclub/core/dice/engine";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useI18n } from "../../../i18n";
import { OnlineScreenFrame } from "../../sessions/components/online-screen-frame";
import { BiddingTable } from "./bidding-table";
import { DiceLobby } from "./dice-lobby";
import { ScoresheetTable } from "./scoresheet-table";
import { useDiceTable } from "./use-dice-table";

export function DiceTableScreen({ sessionId }: { sessionId: string }) {
	useKeepAwake();
	const router = useRouter();
	const { t } = useI18n();
	const dice = t.games.dice;
	const controls = useDiceTable(sessionId);
	const { table, loading } = controls;

	if (loading || !table) {
		return (
			<OnlineScreenFrame
				title={t.catalog["dice-games"].title}
				loading={loading}
				loadingMessage={dice.session.loading}
				blocked={dice.session.notFound}
				blockedAction={{
					label: dice.session.backToGames,
					onPress: () => router.dismissTo("/dice"),
				}}
			/>
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
