import { seatName } from "@arcadeclub/core/cards/table-view";
import { useMessages } from "#/lib/i18n";
import type { CardTableBundle } from "./useCardTable";

/**
 * Points per round and the running total, for families that play several
 * rounds. One row per seat, or per entry of `labels` (such as teams).
 */
export function ScoreBoard({
	table,
	scores,
	totals,
	empty,
	totalLabel,
	labels,
	heading,
}: {
	table: CardTableBundle;
	scores: readonly (readonly number[])[];
	totals: readonly number[];
	/** Row names, when rows are not seats; `scores` and `totals` follow them. */
	labels?: readonly string[];
	/** The first column's heading, when rows are not players. */
	heading?: string;
	/** Shown before the first round is scored. */
	empty: string;
	totalLabel: string;
}) {
	const cards = useMessages().games.cards;
	if (scores.length === 0) {
		return <p className="text-sm">{empty}</p>;
	}
	const rows =
		labels ?? table.seats.map((_, seat) => seatName(cards, table, seat));
	// A long match has more rounds than fit, so the columns scroll sideways.
	return (
		<div className="score-scroll">
			<table className="score-table">
				<thead>
					<tr>
						<th scope="col">{heading ?? cards.table.playerHeading}</th>
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
					{rows.map((label, row) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: rows are fixed during a game.
						<tr key={row}>
							<td>{label}</td>
							{scores.map((round, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: rounds only ever append.
								<td key={index}>{round[row]}</td>
							))}
							<td className="font-bold">{totals[row]}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
