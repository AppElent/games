import type { DiceGame } from "@arcadeclub/core/dice/engine";
import { diceSeatName } from "@arcadeclub/core/dice/table-view";
import { buildInviteUrl } from "@arcadeclub/core/sessions";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { ScrollText } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Sheet } from "#/components/table/Chrome";
import { fmt, useMessages } from "#/lib/i18n";
import { DicePage } from "./Chrome";
import { DiceRulesSheet } from "./RulesSheet";
import type { DiceTableBundle, DiceTableControls } from "./useDiceTable";

/**
 * What every dice table in play shares, whatever its family: the page and its
 * heading, the rules, the spectator's note, the live region a screen reader
 * hears, the error toast, and the end-of-game dialog.
 */
export function DiceTableFrame({
	game,
	table,
	controls,
	kicker,
	news,
	end,
	children,
}: {
	game: DiceGame;
	table: DiceTableBundle;
	controls: DiceTableControls;
	kicker: string;
	news: { seq: number; text: string } | null;
	end: ReactNode;
	children: ReactNode;
}) {
	const dice = useMessages().games.dice;
	const text = dice.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);

	return (
		<DicePage
			title={text.name}
			felt={game.felt}
			crumbs={[
				{ label: dice.hub.kicker, to: "/dice" },
				{ label: text.name, to: "/dice/$gameId", params: { gameId: game.id } },
				{ label: dice.table.crumb },
			]}
		>
			<div className="dice-top">
				<div className="min-w-0">
					<p className="cards-kicker">{kicker}</p>
					<h1 className="cards-title text-3xl">{text.name}</h1>
				</div>
				<button
					type="button"
					className="icon-chip"
					aria-label={dice.table.rules}
					onClick={() => setRulesOpen(true)}
				>
					<ScrollText className="h-4 w-4" aria-hidden="true" />
					<span>{dice.table.rules}</span>
				</button>
			</div>
			{table.you === null ? (
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
			) : null}
			{children}
			<p className="sr-only" aria-live="polite">
				{news ? <span key={news.seq}>{news.text}</span> : null}
			</p>
			{controls.error ? (
				<p className="dice-error" role="alert">
					{controls.error}
				</p>
			) : null}
			{end}
			<DiceRulesSheet
				game={game}
				options={table.options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</DicePage>
	);
}

/** While the computer plays your seat: say so, and offer it back. */
export function AutopilotNotice({
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

/**
 * Who may hand another player's seat to the computer: the host at any time,
 * anyone once that player stops responding. `sheet` is the menu to render.
 */
export function useSeatMenu(
	table: DiceTableBundle,
	controls: DiceTableControls,
	now: number,
) {
	const dice = useMessages().games.dice;
	const [menuSeat, setMenuSeat] = useState<number | null>(null);
	const name = (seat: number) => diceSeatName(dice, table, seat);

	const canManage = (seat: number) => {
		const entry = table.seats[seat];
		return (
			table.you !== null &&
			seat !== table.you &&
			entry.botIndex === null &&
			!entry.autopilot &&
			(table.isHost || seatIsSilent(entry, now))
		);
	};

	const sheet = (
		<Sheet
			open={menuSeat !== null}
			title={
				menuSeat === null
					? ""
					: fmt(dice.table.seatMenu, { name: name(menuSeat) })
			}
			onClose={() => setMenuSeat(null)}
		>
			{menuSeat === null ? null : (
				<button
					type="button"
					className="btn-gold w-full"
					onClick={() => {
						controls.setAutopilot(menuSeat, true);
						setMenuSeat(null);
					}}
				>
					{fmt(dice.table.autopilotOn, { name: name(menuSeat) })}
				</button>
			)}
		</Sheet>
	);

	return { canManage, open: setMenuSeat, sheet };
}
