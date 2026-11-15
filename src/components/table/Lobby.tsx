import { buildInviteUrl } from "@arcadeclub/core/sessions";
import { Bot, Plus, X } from "lucide-react";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { sessionInviteUrl } from "#/lib/games/invite";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import type { Id } from "../../../convex/_generated/dataModel";

/** The lobby's text: `cards.lobby` and `dice.lobby` share these keys. */
export type LobbyWords = {
	kicker: string;
	codeLabel: string;
	seatsHeading: string;
	seatsCount: string;
	hostBadge: string;
	botBadge: string;
	addBot: string;
	removeSeat: string;
	startButton: string;
	needPlayers: { one: string; other: string };
	waitingForHost: string;
	watching: string;
	joinPrompt: string;
	joinButton: string;
	houseRulesOn: string;
};

type LobbyTable = {
	session: { joinCode: string | null };
	seats: ReadonlyArray<{
		participantId: Id<"sessionParticipants"> | null;
		botIndex: number | null;
		isHost: boolean;
	}>;
	you: number | null;
	isHost: boolean;
	options: readonly string[];
};

type LobbyControls = {
	pending: boolean;
	error: string;
	addBot: () => void;
	removeSeat: (index: number) => void;
	start: () => void;
};

/**
 * A table game before it starts: invite people, fill seats, and the host
 * starts. The game's page wraps it; this is the same for every game.
 */
export function TableLobby({
	name,
	players,
	table,
	controls,
	words,
	seatName,
	optionLabel,
	rulesButton,
	onRules,
}: {
	name: string;
	players: { min: number; max: number };
	table: LobbyTable;
	controls: LobbyControls;
	words: LobbyWords;
	seatName: (seat: number) => string;
	optionLabel: (id: string) => string | undefined;
	rulesButton: string;
	onRules: () => void;
}) {
	const { locale } = useI18n();
	const messages = useMessages();
	const code = table.session.joinCode ?? "";
	const missing = Math.max(0, players.min - table.seats.length);
	const canAdd = table.seats.length < players.max;
	const url = sessionInviteUrl({ joinCode: code });

	return (
		<>
			<p className="cards-kicker mb-1">{words.kicker}</p>
			<h1 className="cards-title mb-4 text-4xl">{name}</h1>
			{table.you === null && canAdd ? (
				<div className="cards-panel mb-4 flex flex-wrap items-center gap-3 p-4">
					<p className="min-w-0 flex-1 text-sm">{words.joinPrompt}</p>
					<a href={buildInviteUrl("", { code })} className="btn-gold">
						{words.joinButton}
					</a>
				</div>
			) : null}
			<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div className="flex flex-col gap-4">
					<section className="cards-panel p-5 text-center">
						<h2 className="cards-kicker mb-1">{words.codeLabel}</h2>
						<p className="font-mono text-5xl font-bold tracking-[0.2em] text-[var(--gold)]">
							{code}
						</p>
					</section>
					<QrSharePanel url={url} label={messages.common.room.invitePlayers} />
				</div>
				<section className="cards-panel flex flex-col gap-3 p-5">
					<div className="flex items-baseline justify-between gap-2">
						<h2 className="cards-title text-xl">{words.seatsHeading}</h2>
						<p className="text-sm text-[var(--ivory-muted)]">
							{fmt(words.seatsCount, {
								count: table.seats.length,
								max: players.max,
							})}
						</p>
					</div>
					<ul className="flex flex-col gap-1.5">
						{table.seats.map((seat, index) => {
							const seatLabel = seatName(index);
							return (
								<li
									key={seat.participantId ?? `bot-${seat.botIndex}`}
									className="flex min-h-11 items-center gap-2 rounded-lg bg-black/25 px-3 py-1"
								>
									{seat.botIndex !== null ? (
										<Bot
											className="h-4 w-4 flex-none opacity-75"
											aria-hidden="true"
										/>
									) : null}
									<span className="min-w-0 flex-1 truncate font-semibold">
										{seatLabel}
									</span>
									{seat.isHost ? (
										<span className="cards-kicker">{words.hostBadge}</span>
									) : null}
									{seat.botIndex !== null ? (
										<span className="text-xs text-[var(--ivory-muted)]">
											{words.botBadge}
										</span>
									) : null}
									{table.isHost && !seat.isHost ? (
										<button
											type="button"
											aria-label={fmt(words.removeSeat, { name: seatLabel })}
											onClick={() => controls.removeSeat(index)}
											className="stepper-btn"
										>
											<X className="h-4 w-4" />
										</button>
									) : null}
								</li>
							);
						})}
					</ul>
					{table.isHost && canAdd ? (
						<button
							type="button"
							className="btn-ghost"
							disabled={controls.pending}
							onClick={controls.addBot}
						>
							<Plus className="h-4 w-4" aria-hidden="true" />
							{words.addBot}
						</button>
					) : null}
					{table.options.length > 0 ? (
						<p className="text-sm text-[var(--ivory-muted)]">
							{words.houseRulesOn}: {table.options.map(optionLabel).join(", ")}
						</p>
					) : null}
					{controls.error ? (
						<p role="alert" className="text-sm font-semibold text-orange-200">
							{controls.error}
						</p>
					) : null}
					{table.isHost ? (
						<>
							{missing > 0 ? (
								<p className="text-sm text-[var(--ivory-muted)]">
									{plural(locale, missing, words.needPlayers)}
								</p>
							) : null}
							<button
								type="button"
								className="btn-gold min-h-12 text-lg"
								disabled={missing > 0 || controls.pending}
								onClick={controls.start}
							>
								{words.startButton}
							</button>
						</>
					) : table.you !== null ? (
						<p className="text-sm text-[var(--ivory-muted)]">
							{words.waitingForHost}
						</p>
					) : (
						<p className="text-sm text-[var(--ivory-muted)]">
							{words.watching}
						</p>
					)}
					<button type="button" className="btn-ghost" onClick={onRules}>
						{rulesButton}
					</button>
				</section>
			</div>
		</>
	);
}
