import type { FeltColor } from "@arcadeclub/core/cards/engine";
import type { ReactNode } from "react";
import {
	type TableCrumb,
	TableNotFound,
	TablePage,
} from "#/components/table/Chrome";
import { useMessages } from "#/lib/i18n";
import "./dice.css";

/** Felt-covered page for the screens around a dice game: hub, setup, lobby. */
export function DicePage(props: {
	title: string;
	felt: FeltColor;
	crumbs: TableCrumb[];
	children: ReactNode;
}) {
	const label = useMessages().games.dice.table.crumbsLabel;
	return <TablePage {...props} crumbsLabel={label} />;
}

/** A panel saying what could not be found, with the way back to the dice games. */
export function DiceNotFound({ heading }: { heading: string }) {
	const dice = useMessages().games.dice;
	return (
		<TableNotFound
			heading={heading}
			back={{ to: "/dice", label: dice.session.backToGames }}
		/>
	);
}
