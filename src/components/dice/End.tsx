import { diceSeatName, winnerTitle } from "@arcadeclub/core/dice/table-view";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useMessages } from "#/lib/i18n";
import type { DiceTableBundle, DiceTableControls } from "./useDiceTable";

/** The end of any dice game: who won, everyone's final standing, and what next. */
export function DiceEnd({
	table,
	winners,
	rows,
	heading,
	controls,
}: {
	table: DiceTableBundle;
	winners: readonly number[];
	/** What the standings rank by; "Standings" unless the game says otherwise. */
	heading?: string;
	/** Best first: each seat with what it finished on, in words. */
	rows: ReadonlyArray<{ seat: number; value: string | number }>;
	controls: DiceTableControls;
}) {
	const dice = useMessages().games.dice;
	const dialog = useRef<HTMLDialogElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const you = table.you;
	const title = winnerTitle(dice, table, winners);

	// Modal, so nothing on the table behind it can be reached.
	useEffect(() => {
		dialog.current?.showModal();
		titleRef.current?.focus();
	}, []);

	return (
		<dialog
			ref={dialog}
			className="end-backdrop"
			aria-labelledby="dice-end"
			onCancel={(event) => event.preventDefault()}
			// Browsers can close a dialog despite the cancelled event above.
			onClose={() => dialog.current?.showModal()}
		>
			<section className="cards-panel end-panel" aria-labelledby="dice-end">
				<h2
					id="dice-end"
					ref={titleRef}
					tabIndex={-1}
					className="cards-title text-3xl outline-none"
				>
					{title}
				</h2>
				<h3 className="cards-kicker mt-4 mb-2">
					{heading ?? dice.table.standings}
				</h3>
				<ol className="dice-standings">
					{rows.map(({ seat, value }) => (
						<li key={seat} data-winner={winners.includes(seat)}>
							<span className="min-w-0 flex-1 truncate">
								{diceSeatName(dice, table, seat)}
							</span>
							<span className="font-bold">{value}</span>
						</li>
					))}
				</ol>
				<div className="end-actions mt-2 flex flex-wrap items-center justify-center gap-2">
					{you !== null ? (
						<button
							type="button"
							className="btn-gold"
							disabled={controls.pending}
							onClick={controls.rematch}
						>
							{dice.table.playAgain}
						</button>
					) : (
						<p className="w-full text-sm text-[var(--ivory-muted)]">
							{dice.table.waitingRematch}
						</p>
					)}
					<Link to="/dice" className="btn-ghost">
						{dice.table.newGame}
					</Link>
				</div>
			</section>
		</dialog>
	);
}
