import { type CardGameId, getCardGame } from "@arcadeclub/core/cards/engine";
import { useUser } from "@clerk/react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { HostGate } from "#/components/games/HostGate";
import { newCardSeatSecret, rememberCardSeat } from "#/lib/games/card-seat";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { useGameAction } from "#/lib/games/use-game-action";
import { useHostDisplayName } from "#/lib/games/use-host-session";
import { plural, useI18n, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import { CardsPage } from "./Chrome";
import { RulesSheet } from "./RulesSheet";

type CardTableMode = "computer" | "friends";

/**
 * Opening a table: against the computer it deals at once with bots in the
 * other seats, with friends it opens a room to share. This device keeps the
 * host's seat, then goes to the table. `busy` clears only on failure.
 */
function useCreateCardTable(gameId: CardGameId) {
	const cards = useMessages().games.cards;
	const navigate = useNavigate();
	const create = useMutation(api.cardGames.createTable);
	const { user } = useUser();
	const hostName = useHostDisplayName();
	const { error, run } = useGameAction();
	const [busy, setBusy] = useState(false);

	async function createTable({
		mode,
		opponents,
		options,
	}: {
		mode: CardTableMode;
		opponents: number;
		options: string[];
	}) {
		setBusy(true);
		const succeeded = await run(async () => {
			const guest = getOrCreateGuestIdentity();
			const solo = mode === "computer";
			const seatSecret = newCardSeatSecret();
			const { sessionId, participantId } = await create({
				seatSecret,
				joinMode: solo ? "solo" : "room",
				title: cards.games[gameId].name,
				displayName: user ? hostName : guest.displayName,
				guestId: guest.id,
				gameId,
				options,
				bots: solo ? opponents : 0,
				start: solo,
			});
			rememberCardSeat(sessionId, participantId, seatSecret, true);
			await navigate({
				to: "/cards/table/$sessionId",
				params: { sessionId },
			});
		}, cards.setup.couldNotCreate);
		if (!succeeded) {
			setBusy(false);
		}
	}

	return { busy, error, createTable };
}

/** Picking how to play a card game, then opening its table. */
export function CardSetup({ gameId }: { gameId: CardGameId }) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const game = getCardGame(gameId);
	const text = cards.games[gameId];
	const optionText = text.options as Record<
		string,
		{ label: string; hint: string }
	>;
	const [mode, setMode] = useState<CardTableMode>("computer");
	const [opponents, setOpponents] = useState(Math.min(game.players.max - 1, 3));
	const [options, setOptions] = useState<string[]>([]);
	const [rulesOpen, setRulesOpen] = useState(false);
	const { busy, error, createTable } = useCreateCardTable(gameId);
	const create = () => createTable({ mode, opponents, options });

	const button = (
		<button
			type="button"
			className="btn-gold min-h-12 w-full text-lg"
			disabled={busy}
			onClick={create}
		>
			{busy
				? cards.setup.creating
				: mode === "computer"
					? cards.setup.playNow
					: cards.setup.openRoom}
		</button>
	);

	return (
		<CardsPage
			title={text.name}
			felt={game.felt}
			crumbs={[{ label: cards.hub.kicker, to: "/cards" }, { label: text.name }]}
		>
			<div className="mx-auto w-full max-w-xl">
				<p className="cards-kicker mb-1">{text.tagline}</p>
				<h1 className="cards-title mb-2 text-4xl sm:text-5xl">{text.name}</h1>
				<p className="mb-5 text-[var(--ivory-muted)]">{text.blurb}</p>
				<div className="cards-panel flex flex-col gap-5 p-5">
					<fieldset>
						<legend className="cards-kicker mb-2">
							{cards.setup.modeLabel}
						</legend>
						<div className="grid grid-cols-2 gap-2">
							{(
								[
									[
										"computer",
										cards.setup.vsComputer,
										cards.setup.vsComputerHint,
									],
									[
										"friends",
										cards.setup.withFriends,
										cards.setup.withFriendsHint,
									],
								] as const
							).map(([value, label, hint]) => (
								<label key={value} className="mode-option">
									<input
										type="radio"
										name="mode"
										value={value}
										checked={mode === value}
										onChange={() => setMode(value)}
										className="sr-only"
									/>
									<span className="block font-bold">{label}</span>
									<span className="mt-0.5 block text-xs leading-snug text-[var(--ivory-muted)]">
										{hint}
									</span>
								</label>
							))}
						</div>
					</fieldset>
					{mode === "computer" ? (
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<span className="cards-kicker">{cards.setup.opponentsLabel}</span>
							<div className="flex items-center justify-between gap-2 sm:justify-start">
								<button
									type="button"
									className="stepper-btn"
									aria-label={cards.setup.fewerOpponents}
									disabled={opponents <= game.players.min - 1}
									onClick={() => setOpponents((count) => count - 1)}
								>
									<Minus className="h-4 w-4" />
								</button>
								<output
									aria-live="polite"
									className="min-w-[9rem] text-center font-bold whitespace-nowrap"
								>
									{plural(locale, opponents, cards.setup.opponents)}
								</output>
								<button
									type="button"
									className="stepper-btn"
									aria-label={cards.setup.moreOpponents}
									disabled={opponents >= game.players.max - 1}
									onClick={() => setOpponents((count) => count + 1)}
								>
									<Plus className="h-4 w-4" />
								</button>
							</div>
						</div>
					) : null}
					{game.options.length > 0 ? (
						<div>
							<h2 className="cards-kicker mb-1">{cards.setup.houseRules}</h2>
							<div className="divide-y divide-white/10">
								{game.options.map((option) => {
									const on = options.includes(option.id);
									const label = optionText[option.id];
									return (
										<button
											key={option.id}
											type="button"
											role="switch"
											aria-checked={on}
											className="rule-switch"
											onClick={() =>
												setOptions((current) =>
													on
														? current.filter((id) => id !== option.id)
														: [...current, option.id],
												)
											}
										>
											<span className="min-w-0">
												<span className="block font-semibold">
													{label.label}
												</span>
												<span className="block text-xs leading-snug text-[var(--ivory-muted)]">
													{label.hint}
												</span>
											</span>
											<span className="rule-switch-track" aria-hidden="true" />
										</button>
									);
								})}
							</div>
						</div>
					) : null}
					{error ? (
						<p role="alert" className="text-sm font-semibold text-orange-200">
							{error}
						</p>
					) : null}
					{mode === "computer" ? button : <HostGate>{button}</HostGate>}
					<button
						type="button"
						className="btn-ghost"
						onClick={() => setRulesOpen(true)}
					>
						{cards.setup.rulesButton}
					</button>
				</div>
				<RulesSheet
					game={game}
					options={options}
					open={rulesOpen}
					onClose={() => setRulesOpen(false)}
				/>
			</div>
		</CardsPage>
	);
}
