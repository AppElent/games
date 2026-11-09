/** Picks the screen for a table's state; the rule family picks the table itself. */
import { getCardGame } from "@arcadeclub/core/cards/engine";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useI18n } from "../../../i18n";
import { OnlineScreenFrame } from "../../sessions/components/online-screen-frame";
import { LobbyPanel } from "./lobby-panel";
import { RummyTable } from "./rummy-table";
import { SheddingTable } from "./shedding-table";
import { useCardTable } from "./use-card-table";

export function CardTableScreen({ sessionId }: { sessionId: string }) {
	useKeepAwake();
	const router = useRouter();
	const { t } = useI18n();
	const cards = t.games.cards;
	const controls = useCardTable(sessionId);
	const { table, loading } = controls;

	if (loading || !table) {
		return (
			<OnlineScreenFrame
				title={t.catalog["card-games"].title}
				loading={loading}
				loadingMessage={cards.session.loading}
				blocked={cards.session.notFound}
				blockedAction={{
					label: cards.session.backToGames,
					onPress: () => router.dismissTo("/cards"),
				}}
			/>
		);
	}

	const game = getCardGame(table.gameId);
	if (table.status === "lobby" || !table.view) {
		return <LobbyPanel game={game} table={table} controls={controls} />;
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
