import type { DiceView } from "@arcadeclub/core/dice/engine";
import { diceSeatName, standings } from "@arcadeclub/core/dice/table-view";
import { buildInviteUrl } from "@arcadeclub/core/sessions";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Link } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { useEffect, useRef } from "react";
import { Sheet } from "#/components/table/Chrome";
import { fmt, useI18n, useMessages } from "#/lib/i18n";
import type { DiceTableBundle, DiceTableControls } from "./useDiceTable";

/** What every dice table shows above its play area: where it is, the game, and the rules. */
export function DiceTableTop({
	kicker,
	name,
	onRules,
}: {
	kicker: string;
	name: string;
	onRules: () => void;
}) {
	const dice = useMessages().games.dice;
	return (
		<div className="dice-top">
			<div className="min-w-0">
				<p className="cards-kicker">{kicker}</p>
				<h1 className="cards-title text-3xl">{name}</h1>
			</div>
			<button
				type="button"
				className="icon-chip"
				aria-label={dice.table.rules}
				onClick={onRules}
			>
				<ScrollText className="h-4 w-4" aria-hidden="true" />
				<span>{dice.table.rules}</span>
			</button>
		</div>
	);
}

/** Tells a viewer without a seat they are watching, with the way back in. */
export function SpectatorNote({ table }: { table: DiceTableBundle }) {
	const dice = useMessages().games.dice;
	if (table.you !== null) {
		return null;
	}
	return (
		<p className="dice-note">
			{dice.table.spectating}
			{table.session.joinCode ? (
				<>
					{" · "}
					<a href={buildInviteUrl("", { code: table.session.joinCode })}>
						{dice.table.rejoin}
					</a>
				</>
			) : null}
		</p>
	);
}

/** Who may hand a seat to the computer: its own player, the host, or anyone once it goes quiet. */
export function seatManagement(
	table: DiceTableBundle,
	seat: number,
	now: number,
) {
	const entry = table.seats[seat];
	const human = entry.botIndex === null;
	const silent = seatIsSilent(entry, now);
	return {
		human,
		silent,
		canManage:
			table.you !== null &&
			seat !== table.you &&
			human &&
			!entry.autopilot &&
			(table.isHost || silent),
	};
}

/** The sheet that hands someone's seat to the computer. */
export function SeatMenu({
	table,
	seat,
	controls,
	onClose,
}: {
	table: DiceTableBundle;
	seat: number | null;
	controls: DiceTableControls;
	onClose: () => void;
}) {
	const dice = useMessages().games.dice;
	const name = seat === null ? "" : diceSeatName(dice, table, seat);
	return (
		<Sheet
			open={seat !== null}
			title={seat === null ? "" : fmt(dice.table.seatMenu, { name })}
			onClose={onClose}
		>
			{seat === null ? null : (
				<button
					type="button"
					className="btn-gold w-full"
					onClick={() => {
						controls.setAutopilot(seat, true);
						onClose();
					}}
				>
					{fmt(dice.table.autopilotOn, { name })}
				</button>
			)}
		</Sheet>
	);
}

/** Tells a player the computer has their seat, with the way to take it back. */
export function AutopilotNote({
	table,
	controls,
}: {
	table: DiceTableBundle;
	controls: DiceTableControls;
}) {
	const dice = useMessages().games.dice;
	const you = table.you;
	if (you === null || !table.seats[you]?.autopilot) {
		return null;
	}
	return (
		<div className="dice-actions">
			<p className="text-sm">{dice.table.autopilotActive}</p>
			<button
				type="button"
				className="btn-gold"
				onClick={() => controls.setAutopilot(you, false)}
			>
				{dice.table.autopilotBack}
			</button>
		</div>
	);
}

/** The end of any dice game: who won, everyone's total, and what next. */
export function DiceEnd({
	table,
	view,
	controls,
}: {
	table: DiceTableBundle;
	view: DiceView;
	controls: DiceTableControls;
}) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const dialog = useRef<HTMLDialogElement>(null);
	const heading = useRef<HTMLHeadingElement>(null);
	const you = table.you;
	const title =
		view.winners.length > 1
			? dice.table.tie
			: view.winners[0] === you
				? dice.table.youWin
				: fmt(dice.table.winner, {
						name: diceSeatName(dice, table, view.winners[0]),
					});

	// Modal, so nothing on the table behind it can be reached.
	useEffect(() => {
		dialog.current?.showModal();
		heading.current?.focus();
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
					ref={heading}
					tabIndex={-1}
					className="cards-title text-3xl outline-none"
				>
					{title}
				</h2>
				<h3 className="cards-kicker mt-4 mb-2">{dice.table.standings}</h3>
				<ol className="dice-standings">
					{standings(view).map(({ seat, total }) => (
						<li key={seat} data-winner={view.winners.includes(seat)}>
							<span className="min-w-0 flex-1 truncate">
								{diceSeatName(dice, table, seat)}
							</span>
							<span className="font-bold">{total.toLocaleString(locale)}</span>
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
