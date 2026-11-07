/** Picks the screen for a table's state; the rule family picks the table itself. */
import { getCardGame } from "@arcadeclub/core/cards/engine";
import { useKeepAwake } from "expo-keep-awake";
import { Stack, useRouter } from "expo-router";
import { useMemo } from "react";
import { useI18n } from "../../../i18n";
import { CenteredState } from "../../../ui/centered-state";
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
	const title = t.catalog["card-games"].title;
	const waitingOptions = useMemo(() => ({ title }), [title]);

	if (loading || !table) {
		return (
			<>
				<Stack.Screen options={waitingOptions} />
				{loading ? (
					<CenteredState loading message={cards.session.loading} />
				) : (
					<CenteredState
						title={cards.session.notFound}
						action={{
							label: cards.session.backToGames,
							onPress: () => router.dismissTo("/cards"),
						}}
					/>
				)}
			</>
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
