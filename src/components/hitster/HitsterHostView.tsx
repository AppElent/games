import { useMutation } from "convex/react";
import { useState } from "react";
import { ParticipantList } from "#/components/games/ParticipantList";
import { getUserErrorMessage } from "#/lib/games/errors";
import { getHitsterModeConfig, type HitsterMode } from "#/lib/games/hitster";
import { getHitsterPack } from "#/lib/games/hitsterPacks";
import { formatJoinCode } from "#/lib/games/sessions";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { HitsterBundle } from "./HitsterBits";
import { HitsterStage } from "./HitsterStage";

export function HitsterHostView({
	bundle,
	participantId,
}: {
	bundle: HitsterBundle;
	participantId: Id<"sessionParticipants">;
}) {
	const { locale, messages } = useI18n();
	const hostView = messages.games.hitster.hostView;
	const start = useMutation(api.hitster.start);
	const reveal = useMutation(api.hitster.reveal);
	const nextRound = useMutation(api.hitster.nextRound);
	const [error, setError] = useState("");
	const state = bundle.state;
	const config = state ? getHitsterModeConfig(state.mode as HitsterMode) : null;
	const pack = state ? getHitsterPack(state.packId) : undefined;

	const hostAction = async (action: () => Promise<unknown>) => {
		setError("");
		try {
			await action();
		} catch (caught) {
			setError(getUserErrorMessage(caught, hostView.actionFailed));
		}
	};

	return (
		<div className="grid gap-5 lg:grid-cols-[1fr_300px]">
			<section className="space-y-5">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
							{hostView.kicker}
						</p>
						<h1 className="text-3xl font-bold tracking-tight text-[var(--club-text)]">
							{fmt(hostView.roomHeading, { label: config?.label ?? "Hitster" })}
						</h1>
						{state && pack ? (
							<p className="mt-1 text-sm text-[var(--club-soft)]">
								{state.phase !== "lobby"
									? fmt(hostView.packSummaryWithTracks, {
											packTitle: pack.title,
											target: state.targetCards,
											count: state.deckRemaining,
										})
									: fmt(hostView.packSummaryNoTracks, {
											packTitle: pack.title,
											target: state.targetCards,
										})}
							</p>
						) : null}
					</div>
					<div className="rounded-2xl border border-[var(--club-line)] bg-[var(--club-panel)] px-4 py-3 text-right">
						<span className="block text-xs font-bold uppercase tracking-wide text-[var(--club-soft)]">
							{hostView.joinCodeLabel}
						</span>
						<span className="text-3xl font-bold tabular-nums tracking-tight text-[var(--club-text)]">
							{bundle.session.joinCode
								? formatJoinCode(bundle.session.joinCode)
								: "------"}
						</span>
					</div>
				</div>

				{error ? <p className="text-sm text-orange-300">{error}</p> : null}

				{state?.phase === "lobby" ? (
					<div className="rounded-3xl border border-[var(--club-line)] bg-[var(--club-panel)] p-6">
						<p className="text-[var(--club-muted)]">
							{config?.shared
								? hostView.lobbyInstructionsShared
								: hostView.lobbyInstructionsSolo}
						</p>
						<button
							type="button"
							className="mt-4 rounded-xl bg-blue-600 px-6 py-3 font-bold text-[#fff]"
							onClick={() =>
								hostAction(() =>
									start({ sessionId: bundle.session._id, participantId }),
								)
							}
						>
							{hostView.startGame}
						</button>
					</div>
				) : null}

				{state?.phase === "nowPlaying" ? (
					<div className="rounded-3xl border border-blue-500/30 bg-blue-500/5 p-5">
						<p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
							{hostView.djPanelKicker}
						</p>
						{bundle.hostPlayback ? (
							<details className="mt-2">
								<summary className="cursor-pointer font-semibold text-[var(--club-text)]">
									{hostView.revealTrackSummary}
								</summary>
								<div className="mt-2 text-[var(--club-text)]">
									<p className="font-bold">{bundle.hostPlayback.title}</p>
									<p className="text-sm text-[var(--club-soft)]">
										{bundle.hostPlayback.artistNames.join(", ")}
									</p>
									<a
										className="mt-2 inline-block rounded-lg bg-[var(--club-text)] px-4 py-2 text-sm font-bold text-[color:var(--club-bg)]"
										href={bundle.hostPlayback.spotifySearchUrl}
										target="_blank"
										rel="noreferrer"
									>
										{hostView.findOnSpotify}
									</a>
								</div>
							</details>
						) : null}
						<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
							<span className="text-sm text-[var(--club-muted)]">
								{state.pendingGuess
									? hostView.placementLocked
									: hostView.waitingForPlacement}
								{config?.stealsEnabled
									? ` · ${plural(locale, state.stealClaims.length, hostView.stealClaims)}`
									: ""}
							</span>
							<button
								type="button"
								className="rounded-xl bg-[var(--club-text)] px-5 py-2.5 font-bold text-[color:var(--club-bg)] disabled:opacity-50"
								disabled={!state.pendingGuess}
								onClick={() =>
									hostAction(() =>
										reveal({ sessionId: bundle.session._id, participantId }),
									)
								}
							>
								{hostView.revealYear}
							</button>
						</div>
					</div>
				) : null}

				{state?.phase === "reveal" ? (
					<div className="flex justify-end">
						<button
							type="button"
							className="rounded-xl bg-[var(--club-text)] px-5 py-2.5 font-bold text-[color:var(--club-bg)]"
							onClick={() =>
								hostAction(() =>
									nextRound({ sessionId: bundle.session._id, participantId }),
								)
							}
						>
							{hostView.nextRound}
						</button>
					</div>
				) : null}

				<HitsterStage bundle={bundle} participantId={participantId} />
			</section>
			<aside className="space-y-4">
				<ParticipantList participants={bundle.participants} />
			</aside>
		</div>
	);
}
