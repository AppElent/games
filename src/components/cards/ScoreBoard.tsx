import { seatName } from "@arcadeclub/core/cards/table-view";
import { useMessages } from "#/lib/i18n";
import type { CardTableBundle } from "./useCardTable";

/** Points per round and the running total, for families that play several rounds. */
export function ScoreBoard({
	table,
	scores,
	totals,
	empty,
	totalLabel,
}: {
	table: CardTableBundle;
	scores: readonly (readonly number[])[];
	totals: readonly number[];
	/** Shown before the first round is scored. */
	empty: string;
	totalLabel: string;
}) {
	const cards = useMessages().games.cards;
	if (scores.length === 0) {
		return <p className="text-sm">{empty}</p>;
	}
	// A long match has more rounds than fit, so the columns scroll sideways.
	return (
		<div className="score-scroll">
			<table className="score-table">
				<thead>
					<tr>
						<th scope="col">{cards.table.playerHeading}</th>
						{scores.map((_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: rounds only ever append.
							<th key={index} scope="col">
								{index + 1}
							</th>
						))}
						<th scope="col">{totalLabel}</th>
					</tr>
				</thead>
				<tbody>
					{table.seats.map((_, seat) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed during a game.
						<tr key={seat}>
							<td>{seatName(cards, table, seat)}</td>
							{scores.map((round, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: rounds only ever append.
								<td key={index}>{round[seat]}</td>
							))}
							<td className="font-bold">{totals[seat]}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
