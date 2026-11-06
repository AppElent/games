import { SUITS } from "@arcadeclub/core/cards/deck";
import { Link } from "@tanstack/react-router";
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import { useMessages } from "#/lib/i18n";
import { SuitIcon } from "./PlayingCard";
import type { CardTableBundle, CardTableControls } from "./useCardTable";

const CASCADE = Array.from({ length: 16 }, (_, index) => ({
	suit: SUITS[index % SUITS.length],
	x: (index * 37) % 100,
	size: 16 + ((index * 7) % 18),
	duration: 3.4 + ((index * 3) % 5) * 0.5,
	wait: ((index * 11) % 20) / 10,
	spin: 150 + ((index * 43) % 240),
}));

/** The final table: who won, a modest shower of suits for a win, and what next. */
export function EndOverlay({
	table,
	winners,
	title,
	controls,
	children,
}: {
	table: CardTableBundle;
	winners: readonly number[];
	title: string;
	controls: CardTableControls;
	children?: ReactNode;
}) {
	const cards = useMessages().games.cards;
	const dialog = useRef<HTMLDialogElement>(null);
	const heading = useRef<HTMLHeadingElement>(null);
	const won = table.you !== null && winners.includes(table.you);

	// Modal, so nothing on the table behind it can be reached.
	useEffect(() => {
		dialog.current?.showModal();
		heading.current?.focus();
	}, []);

	return (
		<dialog
			ref={dialog}
			className="end-backdrop"
			aria-labelledby="cards-end"
			onCancel={(event) => event.preventDefault()}
			// Browsers can close a dialog despite the cancelled event above.
			onClose={() => dialog.current?.showModal()}
		>
			{won ? (
				<div className="cascade" aria-hidden="true">
					{CASCADE.map((item) => (
						<span
							key={`${item.x}-${item.size}`}
							style={
								{
									"--x": `${item.x}%`,
									"--s": `${item.size}px`,
									"--d": `${item.duration}s`,
									"--w": `${item.wait}s`,
									"--r": `${item.spin}deg`,
									"--c":
										item.suit === "H" || item.suit === "D"
											? "#ef5a65"
											: "#f8f2e2",
								} as CSSProperties
							}
						>
							<SuitIcon suit={item.suit} />
						</span>
					))}
				</div>
			) : null}
			<section className="cards-panel end-panel" aria-labelledby="cards-end">
				<h2
					id="cards-end"
					ref={heading}
					tabIndex={-1}
					className="cards-title text-3xl outline-none"
				>
					{title}
				</h2>
				{children}
				<div className="end-actions mt-2 flex flex-wrap items-center justify-center gap-2">
					{table.you !== null ? (
						<button
							type="button"
							className="btn-gold"
							disabled={controls.pending}
							onClick={controls.rematch}
						>
							{cards.table.playAgain}
						</button>
					) : (
						<p className="w-full text-sm text-[var(--ivory-muted)]">
							{cards.table.waitingRematch}
						</p>
					)}
					<Link to="/cards" className="btn-ghost">
						{cards.table.newGame}
					</Link>
				</div>
			</section>
		</dialog>
	);
}
