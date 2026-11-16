import { diceSeatName } from "@arcadeclub/core/dice/table-view";
import { buildInviteUrl } from "@arcadeclub/core/sessions";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { ScrollText } from "lucide-react";
import { Sheet } from "#/components/table/Chrome";
import { fmt, useMessages } from "#/lib/i18n";
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
