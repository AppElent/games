import type { FunctionReturnType } from "convex/server";
import { getHitsterModeConfig, type HitsterMode } from "#/lib/games/hitster";
import { getHitsterCard, type HitsterCard } from "#/lib/games/hitsterPacks";
import type { api } from "../../../convex/_generated/api";

export type HitsterBundle = NonNullable<
	FunctionReturnType<typeof api.hitster.getBundle>
>;
export type HitsterState = NonNullable<HitsterBundle["state"]>;

export function participantName(
	bundle: HitsterBundle,
	participantId: string | undefined,
) {
	if (!participantId) {
		return "Team";
	}
	return (
		bundle.participants.find((entry) => entry._id === participantId)
			?.displayName ?? "Player"
	);
}

export function resolveTimelineCards(
	state: HitsterState,
	cardIds: string[],
): HitsterCard[] {
	return cardIds
		.map((cardId) => getHitsterCard(state.packId, cardId))
		.filter((card): card is HitsterCard => Boolean(card));
}

export function VinylDisc({ spinning }: { spinning: boolean }) {
	return (
		<div
			aria-hidden
			className={`relative mx-auto block size-40 rounded-full border border-[var(--club-line)] bg-[radial-gradient(circle,#3a3f4d_0%,#15171f_55%,#0a0b0f_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.4)] ${
				spinning
					? "animate-[spin_6s_linear_infinite] motion-reduce:animate-none"
					: ""
			}`}
		>
			<div className="absolute inset-[36%] rounded-full bg-blue-600" />
			<div className="absolute inset-[47%] rounded-full bg-black" />
			<div className="absolute inset-x-0 top-3 mx-auto h-px w-1/2 bg-[var(--club-line)]" />
		</div>
	);
}

export function TimelineRow({
	cards,
	selectedDrop,
	onSelectDrop,
	highlightCardId,
}: {
	cards: HitsterCard[];
	selectedDrop?: number;
	onSelectDrop?: (index: number) => void;
	highlightCardId?: string;
}) {
	const slots: React.ReactNode[] = [];
	for (let index = 0; index <= cards.length; index += 1) {
		if (onSelectDrop) {
			const selected = selectedDrop === index;
			slots.push(
				<button
					key={`drop-${index}`}
					type="button"
					aria-label={`Place here (position ${index + 1})`}
					aria-pressed={selected}
					onClick={() => onSelectDrop(index)}
					className={`h-24 w-11 shrink-0 self-center rounded-xl border-2 border-dashed text-xl font-bold transition focus-visible:outline-2 focus-visible:outline-blue-400 ${
						selected
							? "border-blue-500 bg-blue-500/20 text-blue-700 dark:text-blue-200"
							: "border-[var(--club-line)] text-[var(--club-soft)] hover:border-[var(--club-soft)] hover:text-[var(--club-muted)]"
					}`}
				>
					{selected ? "●" : "+"}
				</button>,
			);
		}
		const card = cards[index];
		if (card) {
			const highlighted = card.id === highlightCardId;
			slots.push(
				<div
					key={card.id}
					className={`w-32 shrink-0 rounded-2xl border p-3 ${
						highlighted
							? "border-blue-500/70 bg-blue-500/10"
							: "border-[var(--club-line)] bg-[var(--club-panel)]"
					}`}
				>
					<p className="text-2xl font-bold tabular-nums text-[var(--club-text)]">
						{card.releaseYear}
					</p>
					<p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--club-text)]">
						{card.title}
					</p>
					<p className="mt-0.5 line-clamp-1 text-xs text-[var(--club-soft)]">
						{card.artistNames.join(", ")}
					</p>
				</div>,
			);
		}
	}
	return (
		<div className="flex items-stretch gap-2 overflow-x-auto pb-2">{slots}</div>
	);
}

export function TokenPips({ tokens }: { tokens: number }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-[var(--club-line)] bg-[var(--club-line)] px-2.5 py-1 text-xs font-semibold tabular-nums text-[var(--club-text)]">
			<span aria-hidden className="size-2 rounded-full bg-blue-500" />
			{tokens} token{tokens === 1 ? "" : "s"}
		</span>
	);
}

export function HitsterScoreboard({ bundle }: { bundle: HitsterBundle }) {
	const state = bundle.state;
	if (!state) {
		return null;
	}
	const config = getHitsterModeConfig(state.mode as HitsterMode);
	if (config.shared) {
		const cards = state.timelines[0]?.cardIds.length ?? 0;
		return (
			<div className="rounded-3xl border border-[var(--club-line)] bg-[var(--club-panel)] p-5">
				<p className="text-xs font-bold uppercase tracking-wide text-[var(--club-soft)]">
					Team progress
				</p>
				<p className="mt-2 text-3xl font-bold tabular-nums text-[var(--club-text)]">
					{cards} / {state.targetCards} cards
				</p>
				<div className="mt-2">
					<TokenPips tokens={state.coopTokens ?? 0} />
				</div>
			</div>
		);
	}
	const rows = state.timelines
		.map((timeline) => ({
			participantId: timeline.participantId,
			name: participantName(bundle, timeline.participantId),
			cards: timeline.cardIds.length,
			tokens:
				state.tokens.find(
					(entry) => entry.participantId === timeline.participantId,
				)?.tokens ?? 0,
		}))
		.sort((a, b) => b.cards - a.cards || b.tokens - a.tokens);
	return (
		<div className="rounded-3xl border border-[var(--club-line)] bg-[var(--club-panel)] p-5">
			<p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--club-soft)]">
				Standings · first to {state.targetCards}
			</p>
			<ol className="space-y-2">
				{rows.map((row, index) => {
					const winner = state.winnerParticipantId === row.participantId;
					return (
						<li
							key={row.participantId ?? index}
							className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
								winner
									? "bg-[var(--club-text)] text-[color:var(--club-bg)]"
									: "bg-[var(--club-line)] text-[var(--club-text)]"
							}`}
						>
							<span className="flex items-center gap-3">
								<span className="w-5 text-sm font-bold tabular-nums opacity-60">
									{index + 1}
								</span>
								<span className="font-semibold">{row.name}</span>
								{winner ? (
									<span className="text-xs font-bold uppercase">Winner</span>
								) : null}
							</span>
							<span className="flex items-center gap-2 text-sm tabular-nums">
								<span className="font-bold">{row.cards} cards</span>
								{getHitsterModeConfig(state.mode as HitsterMode).tokenCap >
								0 ? (
									<span
										className={
											winner ? "opacity-70" : "text-[var(--club-soft)]"
										}
									>
										{row.tokens} tk
									</span>
								) : null}
							</span>
						</li>
					);
				})}
			</ol>
		</div>
	);
}

export function RulesPanel({ state }: { state: HitsterState }) {
	const config = getHitsterModeConfig(state.mode as HitsterMode);
	const rules: Array<{ heading: string; body: string }> = [
		{
			heading: "Listen together",
			body: "The host plays a mystery track. Nobody sees the title, artist or year.",
		},
		{
			heading: "Place it in time",
			body: config.shared
				? "The active player drops the song into the shared team timeline."
				: "The active player drops the song into their own timeline.",
		},
		{
			heading: "Reveal and score",
			body: config.shared
				? `Correct keeps the card. Wrong burns a team token. Reach ${state.targetCards} cards before ${config.startTokens} tokens run out.`
				: `Correct placements grow your timeline. First to ${state.targetCards} cards wins.`,
		},
	];
	if (config.earnTokens) {
		rules.push({
			heading: "Earn tokens",
			body: `Name artist and title for a bonus token (max ${config.tokenCap}). Spend a token to steal a missed card.`,
		});
	}
	if (config.needsArtistTitle) {
		rules.push({
			heading: "Name it to claim it",
			body: config.needsYear
				? "You only win the card with correct placement plus exact year, artist and title. No new tokens."
				: "You only win the card with correct placement plus artist and title. No new tokens.",
		});
	}
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{rules.map((rule, index) => (
				<div
					key={rule.heading}
					className="rounded-2xl border border-[var(--club-line)] bg-[var(--club-panel)] p-4"
				>
					<p className="text-xs font-bold tabular-nums text-blue-600 dark:text-blue-300">
						{String(index + 1).padStart(2, "0")}
					</p>
					<h3 className="mt-1 font-bold text-[var(--club-text)]">
						{rule.heading}
					</h3>
					<p className="mt-1 text-sm leading-relaxed text-[var(--club-muted)]">
						{rule.body}
					</p>
				</div>
			))}
		</div>
	);
}

export function RecapPanel({ bundle }: { bundle: HitsterBundle }) {
	const state = bundle.state;
	const recap = state?.lastRecap;
	if (!state || !recap) {
		return null;
	}
	const card = getHitsterCard(state.packId, recap.cardId);
	const activeName = participantName(bundle, recap.activeParticipantId);
	const wonBy = recap.cardWonByParticipantId
		? participantName(bundle, recap.cardWonByParticipantId)
		: undefined;
	return (
		<div className="rounded-3xl border border-[var(--club-line)] bg-[var(--club-panel)] p-6">
			<p className="text-xs font-bold uppercase tracking-wide text-[var(--club-soft)]">
				Round {recap.roundNumber} recap
			</p>
			{card ? (
				<div className="mt-3">
					<p className="text-5xl font-bold tabular-nums tracking-tight text-[var(--club-text)]">
						{card.releaseYear}
					</p>
					<p className="mt-1 text-xl font-semibold text-[var(--club-text)]">
						{card.title}
					</p>
					<p className="text-sm text-[var(--club-soft)]">
						{card.artistNames.join(", ")}
					</p>
				</div>
			) : null}
			<div className="mt-4 flex flex-wrap gap-2 text-sm">
				<span
					className={`rounded-full px-3 py-1 font-semibold ${
						recap.placementCorrect
							? "bg-blue-500/15 text-blue-700 dark:text-blue-200"
							: "bg-[var(--club-line)] text-[var(--club-muted)]"
					}`}
				>
					{activeName}: placement {recap.placementCorrect ? "correct" : "wrong"}
				</span>
				{recap.artistCorrect !== undefined ? (
					<span className="rounded-full bg-[var(--club-line)] px-3 py-1 text-[var(--club-muted)]">
						Artist {recap.artistCorrect ? "correct" : "wrong"}
					</span>
				) : null}
				{recap.titleCorrect !== undefined ? (
					<span className="rounded-full bg-[var(--club-line)] px-3 py-1 text-[var(--club-muted)]">
						Title {recap.titleCorrect ? "correct" : "wrong"}
					</span>
				) : null}
				{recap.yearCorrect !== undefined ? (
					<span className="rounded-full bg-[var(--club-line)] px-3 py-1 text-[var(--club-muted)]">
						Year {recap.yearCorrect ? "correct" : "wrong"}
					</span>
				) : null}
			</div>
			{recap.cardWonByTeam !== undefined ? (
				<p className="mt-3 text-sm text-[var(--club-muted)]">
					{recap.cardWonByTeam
						? "The card stays on the team timeline."
						: "The card is discarded and the team loses a token."}
				</p>
			) : (
				<p className="mt-3 text-sm text-[var(--club-muted)]">
					{wonBy ? `${wonBy} wins the card.` : "Nobody wins the card."}
				</p>
			)}
			{recap.stealResults.length > 0 ? (
				<ul className="mt-3 space-y-1 text-sm text-[var(--club-muted)]">
					{recap.stealResults.map((steal) => (
						<li key={steal.participantId}>
							Steal by {participantName(bundle, steal.participantId)}:{" "}
							{steal.wonCard
								? "won the card"
								: steal.correct
									? "correct, but too late"
									: "missed"}{" "}
							(−1 token)
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
