import type {
	CardGameDefinition,
	CardGameId,
} from "@arcadeclub/core/cards/engine";
import { buildInviteUrl } from "@arcadeclub/core/sessions";
import { Bot, Plus, X } from "lucide-react";
import { useState } from "react";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { CardsPage } from "./Chrome";
import { seatName } from "./format";
import { RulesSheet } from "./RulesSheet";
import type { CardTableBundle, CardTableControls } from "./useCardTable";

/** The table before the deal: invite people, fill seats, and the host deals. */
export function Lobby({
	game,
	table,
	controls,
}: {
	game: CardGameDefinition;
	table: CardTableBundle;
	controls: CardTableControls;
}) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const text = cards.games[game.id as CardGameId];
	const [rulesOpen, setRulesOpen] = useState(false);
	const code = table.session.joinCode ?? "";
	const optionText = text.options as Record<string, { label: string }>;
	const missing = Math.max(0, game.players.min - table.seats.length);
	const canAdd = table.seats.length < game.players.max;
	const url =
		typeof window === "undefined"
			? ""
			: buildInviteUrl(window.location.origin, { code });

	return (
		<CardsPage
			title={text.name}
			felt={game.felt}
			crumbs={[
				{ label: cards.hub.kicker, to: "/cards" },
				{ label: text.name, to: "/cards/$gameId", params: { gameId: game.id } },
				{ label: cards.table.crumb },
			]}
		>
			<p className="cards-kicker mb-1">{cards.lobby.kicker}</p>
			<h1 className="cards-title mb-4 text-4xl">{text.name}</h1>
			{table.you === null && canAdd ? (
				<div className="cards-panel mb-4 flex flex-wrap items-center gap-3 p-4">
					<p className="min-w-0 flex-1 text-sm">{cards.lobby.joinPrompt}</p>
					<a href={buildInviteUrl("", { code })} className="btn-gold">
						{cards.lobby.joinButton}
					</a>
				</div>
			) : null}
			<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div className="flex flex-col gap-4">
					<section className="cards-panel p-5 text-center">
						<h2 className="cards-kicker mb-1">{cards.lobby.codeLabel}</h2>
						<p className="font-mono text-5xl font-bold tracking-[0.2em] text-[var(--gold)]">
							{code}
						</p>
					</section>
					<QrSharePanel url={url} label={cards.lobby.inviteLabel} />
				</div>
				<section className="cards-panel flex flex-col gap-3 p-5">
					<div className="flex items-baseline justify-between gap-2">
						<h2 className="cards-title text-xl">{cards.lobby.seatsHeading}</h2>
						<p className="text-sm text-[var(--ivory-muted)]">
							{fmt(cards.lobby.seatsCount, {
								count: table.seats.length,
								max: game.players.max,
							})}
						</p>
					</div>
					<ul className="flex flex-col gap-1.5">
						{table.seats.map((seat, index) => {
							const name = seatName(cards, table, index);
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
										{name}
									</span>
									{seat.isHost ? (
										<span className="cards-kicker">
											{cards.lobby.hostBadge}
										</span>
									) : null}
									{seat.botIndex !== null ? (
										<span className="text-xs text-[var(--ivory-muted)]">
											{cards.lobby.botBadge}
										</span>
									) : null}
									{table.isHost && !seat.isHost ? (
										<button
											type="button"
											aria-label={fmt(cards.lobby.removeSeat, { name })}
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
							{cards.lobby.addBot}
						</button>
					) : null}
					{table.options.length > 0 ? (
						<p className="text-sm text-[var(--ivory-muted)]">
							{cards.lobby.houseRulesOn}:{" "}
							{table.options.map((id) => optionText[id]?.label).join(", ")}
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
									{plural(locale, missing, cards.lobby.needPlayers)}
								</p>
							) : null}
							<button
								type="button"
								className="btn-gold min-h-12 text-lg"
								disabled={missing > 0 || controls.pending}
								onClick={controls.start}
							>
								{cards.lobby.startButton}
							</button>
						</>
					) : table.you !== null ? (
						<p className="text-sm text-[var(--ivory-muted)]">
							{cards.lobby.waitingForHost}
						</p>
					) : (
						<p className="text-sm text-[var(--ivory-muted)]">
							{cards.lobby.watching}
						</p>
					)}
					<button
						type="button"
						className="btn-ghost"
						onClick={() => setRulesOpen(true)}
					>
						{cards.setup.rulesButton}
					</button>
				</section>
			</div>
			<RulesSheet
				game={game}
				options={table.options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</CardsPage>
	);
}
