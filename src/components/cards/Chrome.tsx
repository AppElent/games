import type { FeltColor } from "@arcadeclub/core/cards/engine";
import type { ReactNode } from "react";
import {
	type TableCrumb,
	TableCrumbs,
	TableNotFound,
	TablePage,
} from "#/components/table/Chrome";
import { useMessages } from "#/lib/i18n";
import { CardSprite } from "./PlayingCard";

export { Sheet } from "#/components/table/Chrome";

/** The trail back up to the card club; the last step is the page you're on. */
export function CardCrumbs({ items }: { items: TableCrumb[] }) {
	const label = useMessages().games.cards.table.crumbsLabel;
	return <TableCrumbs items={items} label={label} />;
}

/** Felt-covered page for the screens around the game: hub, setup, lobby. */
export function CardsPage(props: {
	title: string;
	felt: FeltColor;
	crumbs: TableCrumb[];
	children: ReactNode;
}) {
	const label = useMessages().games.cards.table.crumbsLabel;
	return <TablePage {...props} crumbsLabel={label} decor={<CardSprite />} />;
}

/** A panel saying what could not be found, with the way back to the card games. */
export function CardsNotFound({ heading }: { heading: string }) {
	const cards = useMessages().games.cards;
	return (
		<TableNotFound
			heading={heading}
			back={{ to: "/cards", label: cards.session.backToGames }}
		/>
	);
}
