import { seatName } from "@arcadeclub/core/cards/table-view";
import { useMessages } from "#/lib/i18n";
import type { CardTableBundle } from "./useCardTable";

/** Round by round per seat, plus each seat's total. */
export function ScoreBoard({
	table,
	scores,
	totals,
}: {
	table: CardTableBundle;
	scores: readonly (readonly number[])[];
	totals: readonly number[];
}) {
	const cards = useMessages().games.cards;
	if (scores.length === 0) {
		return <p className="text-sm">{cards.rummy.noScores}</p>;
	}
	return (
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
					<th scope="col">{cards.rummy.scoreTotal}</th>
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
	);
}
