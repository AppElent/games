import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { getHitsterModeConfig, type HitsterMode } from "#/lib/games/hitster";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
	type HitsterBundle,
	HitsterScoreboard,
	type HitsterState,
	participantName,
	RecapPanel,
	RulesPanel,
	resolveTimelineCards,
	TimelineRow,
	TokenPips,
	VinylDisc,
} from "./HitsterBits";

function useCountdown(state: HitsterState) {
	const active =
		state.phase === "nowPlaying" &&
		state.turnTimerSeconds &&
		state.roundStartedAt;
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) {
			return;
		}
		const interval = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(interval);
	}, [active]);
	if (!active || !state.turnTimerSeconds || !state.roundStartedAt) {
		return null;
	}
	return Math.max(
		0,
		state.turnTimerSeconds - Math.floor((now - state.roundStartedAt) / 1000),
	);
}

function AnswerInputs({
	mode,
	forSteal,
	artist,
	title,
	year,
	onArtist,
	onTitle,
	onYear,
}: {
	mode: HitsterMode;
	forSteal: boolean;
	artist: string;
	title: string;
	year: string;
	onArtist: (value: string) => void;
	onTitle: (value: string) => void;
	onYear: (value: string) => void;
}) {
	const config = getHitsterModeConfig(mode);
	const showArtistTitle =
		config.needsArtistTitle || (!forSteal && config.earnTokens);
	if (!showArtistTitle && !config.needsYear) {
		return null;
	}
	const inputClass =
		"w-full rounded-xl border border-[var(--club-line)] bg-[var(--club-panel-strong)] px-3 py-2.5 text-[var(--club-text)] placeholder:text-[var(--club-soft)] focus-visible:outline-2 focus-visible:outline-blue-400";
	return (
		<div className="grid gap-2 sm:grid-cols-2">
			{showArtistTitle ? (
				<>
					<label className="block text-sm text-[var(--club-muted)]">
						Artist{" "}
						{config.needsArtistTitle ? "(required to win)" : "(bonus token)"}
						<input
							className={`mt-1 ${inputClass}`}
							value={artist}
							onChange={(event) => onArtist(event.target.value)}
							placeholder="Who plays it?"
						/>
					</label>
					<label className="block text-sm text-[var(--club-muted)]">
						Title{" "}
						{config.needsArtistTitle ? "(required to win)" : "(bonus token)"}
						<input
							className={`mt-1 ${inputClass}`}
							value={title}
							onChange={(event) => onTitle(event.target.value)}
							placeholder="What is it called?"
						/>
					</label>
				</>
			) : null}
			{config.needsYear ? (
				<label className="block text-sm text-[var(--club-muted)]">
					Exact year (required to win)
					<input
						className={`mt-1 ${inputClass}`}
						value={year}
						onChange={(event) => onYear(event.target.value)}
						inputMode="numeric"
						placeholder="e.g. 1987"
					/>
				</label>
			) : null}
		</div>
	);
}

function PlacementForm({
	bundle,
	participantId,
	forSteal,
}: {
	bundle: HitsterBundle;
	participantId: Id<"sessionParticipants">;
	forSteal: boolean;
}) {
	const state = bundle.state as HitsterState;
	const submitGuess = useMutation(api.hitster.submitGuess);
	const submitSteal = useMutation(api.hitster.submitSteal);
	const [dropIndex, setDropIndex] = useState<number | undefined>(undefined);
	const [artist, setArtist] = useState("");
	const [title, setTitle] = useState("");
	const [year, setYear] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const config = getHitsterModeConfig(state.mode as HitsterMode);
	const timeline = config.shared
		? state.timelines[0]
		: state.timelines.find((entry) => entry.participantId === participantId);
	const cards = timeline ? resolveTimelineCards(state, timeline.cardIds) : [];

	return (
		<div className="space-y-4">
			<p className="text-sm text-[var(--club-muted)]">
				Pick the spot where the mystery song belongs. Years grow from left to
				right.
			</p>
			<TimelineRow
				cards={cards}
				selectedDrop={dropIndex}
				onSelectDrop={setDropIndex}
			/>
			<AnswerInputs
				mode={state.mode as HitsterMode}
				forSteal={forSteal}
				artist={artist}
				title={title}
				year={year}
				onArtist={setArtist}
				onTitle={setTitle}
				onYear={setYear}
			/>
			{error ? <p className="text-sm text-orange-300">{error}</p> : null}
			<button
				type="button"
				disabled={busy || dropIndex === undefined}
				className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-[#fff] transition disabled:cursor-not-allowed disabled:opacity-50"
				onClick={async () => {
					if (dropIndex === undefined) {
						return;
					}
					setBusy(true);
					setError("");
					try {
						const payload = {
							sessionId: bundle.session._id,
							participantId,
							dropIndex,
							artistGuess: artist.trim() || undefined,
							titleGuess: title.trim() || undefined,
							yearGuess: year.trim() ? Number(year.trim()) : undefined,
						};
						if (forSteal) {
							await submitSteal(payload);
						} else {
							await submitGuess(payload);
						}
					} catch (caught) {
						setError(
							caught instanceof Error ? caught.message : "Could not submit",
						);
					} finally {
						setBusy(false);
					}
				}}
			>
				{forSteal ? "Spend 1 token · lock steal" : "Lock placement"}
			</button>
		</div>
	);
}

export function HitsterStage({
	bundle,
	participantId,
}: {
	bundle: HitsterBundle;
	participantId: Id<"sessionParticipants">;
}) {
	const state = bundle.state;
	const [stealOpen, setStealOpen] = useState(false);
	const remaining = useCountdown((state ?? { phase: "lobby" }) as HitsterState);
	if (!state) {
		return (
			<p className="text-[var(--club-muted)]">
				The host is still setting up the game.
			</p>
		);
	}
	const mode = state.mode as HitsterMode;
	const config = getHitsterModeConfig(mode);
	const activeParticipantId = state.turnOrder[state.activeIndex];
	const activeName = participantName(bundle, activeParticipantId);
	const isActive = activeParticipantId === participantId;
	const myTokens =
		state.tokens.find((entry) => entry.participantId === participantId)
			?.tokens ?? 0;
	const myTimeline = config.shared
		? state.timelines[0]
		: state.timelines.find((entry) => entry.participantId === participantId);
	const myClaim = state.stealClaims.some(
		(claim) => claim.participantId === participantId,
	);
	const isPlaying = state.turnOrder.includes(participantId);

	const status =
		state.phase === "lobby"
			? "Waiting for the host to start"
			: state.phase === "nowPlaying"
				? `Round ${state.roundNumber} · ${activeName}'s turn`
				: state.phase === "reveal"
					? `Round ${state.roundNumber} revealed`
					: "Game over";

	return (
		<div className="space-y-5">
			<div
				aria-live="polite"
				className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--club-line)] bg-[var(--club-panel)] px-4 py-3"
			>
				<span className="font-semibold text-[var(--club-text)]">{status}</span>
				<span className="flex items-center gap-2 text-sm text-[var(--club-muted)]">
					{remaining !== null ? (
						<span className="rounded-full bg-[var(--club-line)] px-3 py-1 font-bold tabular-nums text-[var(--club-text)]">
							{remaining}s
						</span>
					) : null}
					{!config.shared && config.tokenCap > 0 && isPlaying ? (
						<TokenPips tokens={myTokens} />
					) : null}
					{config.shared ? <TokenPips tokens={state.coopTokens ?? 0} /> : null}
				</span>
			</div>

			{state.phase === "lobby" ? (
				<section className="space-y-4">
					<h2 className="text-2xl font-bold tracking-tight text-[var(--club-text)]">
						How {config.label} works
					</h2>
					<RulesPanel state={state} />
				</section>
			) : null}

			{state.phase === "nowPlaying" ? (
				isActive ? (
					<section className="rounded-3xl border border-[var(--club-line)] bg-[var(--club-panel)] p-5">
						<h2 className="mb-4 text-2xl font-bold tracking-tight text-[var(--club-text)]">
							Your turn · place the mystery song
						</h2>
						{state.pendingGuess ? (
							<div className="py-8 text-center">
								<VinylDisc spinning />
								<p className="mt-4 font-semibold text-[var(--club-text)]">
									Placement locked
								</p>
								<p className="text-sm text-[var(--club-soft)]">
									Waiting for the host to reveal the year.
								</p>
							</div>
						) : (
							<PlacementForm
								bundle={bundle}
								participantId={participantId}
								forSteal={false}
							/>
						)}
					</section>
				) : (
					<section className="rounded-3xl border border-[var(--club-line)] bg-[var(--club-panel)] p-6 text-center">
						<VinylDisc spinning />
						<h2 className="mt-4 text-2xl font-bold tracking-tight text-[var(--club-text)]">
							Now playing · answers hidden
						</h2>
						<p className="mt-1 text-[var(--club-muted)]">
							{activeName} is placing the song.{" "}
							{state.pendingGuess ? "Placement locked." : "Listen along."}
						</p>
						{config.stealsEnabled && isPlaying ? (
							myClaim ? (
								<p className="mt-4 text-sm font-semibold text-blue-700 dark:text-blue-200">
									Steal claim locked. The reveal decides.
								</p>
							) : myTokens > 0 ? (
								<div className="mt-5 text-left">
									{stealOpen ? (
										<div className="rounded-2xl border border-[var(--club-line)] bg-[var(--club-panel-strong)] p-4">
											<p className="mb-3 font-semibold text-[var(--club-text)]">
												Steal: place it on your own timeline
											</p>
											<PlacementForm
												bundle={bundle}
												participantId={participantId}
												forSteal
											/>
										</div>
									) : (
										<div className="text-center">
											<button
												type="button"
												className="rounded-xl border border-[var(--club-line)] px-5 py-2.5 font-semibold text-[var(--club-text)] hover:border-[var(--club-soft)]"
												onClick={() => setStealOpen(true)}
											>
												Think they're wrong? Steal for 1 token
											</button>
										</div>
									)}
								</div>
							) : (
								<p className="mt-4 text-sm text-[var(--club-soft)]">
									No tokens left to steal with.
								</p>
							)
						) : null}
					</section>
				)
			) : null}

			{state.phase === "reveal" ? (
				<section className="space-y-4">
					<RecapPanel bundle={bundle} />
					<p className="text-sm text-[var(--club-soft)]">
						Waiting for the host to start the next round.
					</p>
				</section>
			) : null}

			{state.phase === "finished" ? (
				<section className="space-y-4">
					{state.coopResult ? (
						<div className="rounded-3xl border border-[var(--club-line)] bg-[var(--club-panel)] p-8 text-center">
							<h2 className="text-4xl font-bold tracking-tight text-[var(--club-text)]">
								{state.coopResult === "won"
									? "Timeline complete — the team wins"
									: "Out of tokens — the timeline wins"}
							</h2>
						</div>
					) : null}
					{state.lastRecap ? <RecapPanel bundle={bundle} /> : null}
					<HitsterScoreboard bundle={bundle} />
				</section>
			) : null}

			{state.phase !== "lobby" && myTimeline ? (
				<section>
					<h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--club-soft)]">
						{config.shared ? "Team timeline" : "Your timeline"} ·{" "}
						{myTimeline.cardIds.length} card
						{myTimeline.cardIds.length === 1 ? "" : "s"}
					</h3>
					<TimelineRow
						cards={resolveTimelineCards(state, myTimeline.cardIds)}
						highlightCardId={
							state.phase === "reveal" || state.phase === "finished"
								? state.lastRecap?.cardId
								: undefined
						}
					/>
				</section>
			) : null}

			{state.phase !== "finished" && state.phase !== "lobby" ? (
				<HitsterScoreboard bundle={bundle} />
			) : null}
		</div>
	);
}
