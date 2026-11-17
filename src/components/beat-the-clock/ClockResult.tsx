/**
 * After a turn: the score screen, the tie screen before an extra round, and
 * the winner screen with what comes next.
 */
import {
	bestDescriber,
	leadingTeams,
	rankedTeams,
} from "@arcadeclub/core/beat-the-clock";
import { fmt, plural } from "@arcadeclub/core/i18n/format";
import { Trophy } from "lucide-react";
import { useI18n, useMessages } from "#/lib/i18n";
import {
	Card,
	ErrorNotice,
	PrimaryButton,
	SecondaryButton,
	useClockCopy,
	useTeamNames,
} from "./ClockBits";
import type { ClockScreenProps } from "./ClockRoom";

/** Every team with its score and a bar to the target; the leader in amber. */
function Scoreboard({
	scores,
	target,
	showBars,
	label,
	players,
}: {
	scores: readonly number[];
	target: number;
	showBars: boolean;
	label: string;
	players?: (team: number) => string;
}) {
	const copy = useClockCopy();
	const teams = useTeamNames();
	const ranked = rankedTeams({ scores });
	const leaders = leadingTeams({ scores });
	const top = ranked[0]?.score ?? 0;
	let place = 0;
	let previous: number | undefined;
	return (
		<ol aria-label={label} className="flex flex-col gap-2">
			{ranked.map(({ team, score }, index) => {
				if (score !== previous) place = index + 1;
				previous = score;
				const tied = ranked.filter((r) => r.score === score).length > 1;
				const leader = top > 0 && leaders.includes(team);
				return (
					<li
						key={team}
						className={`flex flex-col gap-2 rounded-xl border bg-[var(--club-surface)] px-4 py-3 ${leader ? "border-[var(--club-amber)]" : "border-[var(--club-line)]"}`}
					>
						<div className="flex items-center gap-3">
							{players ? (
								<span className="w-6 text-sm font-bold tabular-nums text-[var(--club-muted)]">
									{tied ? "=" : place}
								</span>
							) : null}
							<span className="min-w-0 flex-1">
								<span className="block font-bold text-[var(--club-text)]">
									{teams.team(team)}
								</span>
								{players ? (
									<span className="block truncate text-sm text-[var(--club-muted)]">
										{players(team)}
									</span>
								) : null}
							</span>
							<span className="club-title text-2xl font-bold tabular-nums text-[var(--club-text)]">
								{score}
							</span>
						</div>
						{showBars ? (
							<div
								role="progressbar"
								aria-label={fmt(copy.score.progress, {
									team: teams.team(team),
									target,
								})}
								aria-valuemin={0}
								aria-valuemax={target}
								aria-valuenow={Math.min(score, target)}
								className="h-1.5 overflow-hidden rounded-full bg-[var(--club-panel-strong)]"
							>
								<div
									className="h-full rounded-full bg-[var(--club-amber)]"
									style={{ width: `${Math.min(1, score / target) * 100}%` }}
								/>
							</div>
						) : null}
					</li>
				);
			})}
		</ol>
	);
}

export function ClockScore({ bundle, view, actions }: ClockScreenProps) {
	const copy = useClockCopy();
	const teams = useTeamNames();
	const { state } = bundle;
	const turn = state.turn;
	const gain = turn?.gain ?? 0;
	const flagged = turn ? turn.flags.filter(Boolean).length : 0;
	const guessed = turn ? turn.ticks.filter(Boolean).length : 0;
	const leaders = leadingTeams(state);
	const upcoming = view.upcoming;

	return (
		<>
			{turn ? (
				<div className="pt-2 text-center">
					<p className="club-title text-6xl font-bold tabular-nums text-[var(--club-amber)]">
						{fmt(copy.score.gain, { n: gain })}
					</p>
					<p className="text-lg font-bold text-[var(--club-text)]">
						{fmt(copy.score.for, { team: teams.team(turn.team) })}
					</p>
					<p className="text-sm text-[var(--club-muted)]">
						{turn.skipped
							? copy.score.skippedDetail
							: flagged > 0
								? fmt(copy.score.detail, {
										n: guessed,
										f: flagged,
										opponents: teams.list(
											view.otherTeams.filter((t) => t !== turn.team),
										),
									})
								: fmt(copy.score.detailNoFlags, { n: guessed })}
					</p>
				</div>
			) : null}
			{state.roundOutcome !== "none" ? (
				<p
					role="status"
					className="text-center font-semibold text-[var(--club-text)]"
				>
					{state.roundOutcome === "tie"
						? fmt(copy.score.roundDoneTie, {
								round: state.round,
								teams: teams.list(leaders),
								score: state.scores[leaders[0] ?? 0] ?? 0,
							})
						: fmt(copy.score.roundDone, {
								round: state.round,
								team: teams.team(leaders[0] ?? 0),
								target: state.target,
							})}
				</p>
			) : null}
			<Scoreboard
				scores={state.scores}
				target={state.target}
				showBars
				label={copy.score.list}
			/>
			<div className="mt-auto flex flex-col gap-3">
				<ErrorNotice message={actions.error} />
				{state.roundOutcome !== "none" ? (
					<PrimaryButton
						busy={actions.pending === "seeWinner"}
						onClick={() => void actions.seeWinner()}
					>
						{copy.score.seeWinner}
					</PrimaryButton>
				) : upcoming && view.youreNext ? (
					<Card className="flex flex-col gap-3 p-4">
						<p className="font-bold text-[var(--club-text)]">
							{copy.score.youNext}
						</p>
						<p className="text-[var(--club-muted)]">
							{fmt(copy.score.youNextBody, { team: teams.team(upcoming.team) })}
						</p>
						<PrimaryButton
							busy={actions.pending === "next"}
							disabled={state.paused}
							onClick={() => void actions.next()}
						>
							{copy.score.next}
						</PrimaryButton>
					</Card>
				) : upcoming ? (
					<Card className="p-4">
						<p className="font-bold text-[var(--club-text)]">
							{fmt(copy.score.nextName, {
								name: view.name(upcoming.describerId),
							})}{" "}
							<span className="font-normal text-[var(--club-muted)]">
								{fmt(copy.score.nextBody, { team: teams.team(upcoming.team) })}
							</span>
						</p>
						<p className="mt-1 text-sm text-[var(--club-muted)]">
							{fmt(copy.score.nextHint, {
								name: view.name(upcoming.describerId),
							})}
						</p>
					</Card>
				) : null}
			</div>
		</>
	);
}

export function ClockTie({ bundle, view, actions }: ClockScreenProps) {
	const copy = useClockCopy();
	const { state } = bundle;
	const top = Math.max(...state.scores);
	return (
		<>
			<Headline
				title={fmt(copy.winner.tieTitle, { score: top })}
				body={copy.winner.tieBody}
			/>
			<Scoreboard
				scores={state.scores}
				target={state.target}
				showBars={false}
				label={copy.winner.list}
				players={(team) => view.teamMembers(team).map(view.name).join(", ")}
			/>
			<div className="mt-auto flex flex-col gap-3">
				<ErrorNotice message={actions.error} />
				<PrimaryButton
					busy={actions.pending === "extraRound"}
					onClick={() => void actions.extraRound()}
				>
					{copy.winner.extraRound}
				</PrimaryButton>
			</div>
		</>
	);
}

export function ClockWinner({ bundle, view, actions }: ClockScreenProps) {
	const copy = useClockCopy();
	const common = useMessages().common;
	const { locale } = useI18n();
	const teams = useTeamNames();
	const { state, session } = bundle;
	const hostName = view.name(session.hostParticipantId);
	const winners = state.winners;
	const tied = winners.length > 1;
	const ranked = rankedTeams(state);
	const topScore = ranked[0]?.score ?? 0;
	const rounds = state.round;
	const best = bestDescriber({
		...state,
		deck: [],
		used: [],
		turn: undefined,
	});
	const reason =
		state.endReason === "host"
			? fmt(copy.winner.endedByHost, { host: hostName })
			: state.endReason === "tooFewTeams"
				? copy.winner.tooFewTeams
				: state.endReason === "ranOut"
					? copy.winner.ranOut
					: null;
	const title = tied
		? fmt(copy.winner.tieTitle, { score: topScore })
		: fmt(copy.winner.title, { team: teams.team(winners[0] ?? 0) });
	const body = tied
		? plural(locale, rounds, copy.winner.endedTieBody)
		: state.teamCount === 2
			? fmt(plural(locale, rounds, copy.winner.body), {
					a: ranked[0]?.score ?? 0,
					b: ranked[1]?.score ?? 0,
				})
			: fmt(plural(locale, rounds, copy.winner.bodyMany), { score: topScore });

	const backToArcade = async () => {
		if (!view.isHost && !view.isWatcher) {
			await actions.leave();
		}
		window.location.href = "/";
	};

	return (
		<>
			{reason ? (
				<p className="text-sm font-semibold text-[var(--club-muted)]">
					{reason}
				</p>
			) : null}
			<Headline
				title={title}
				body={
					!tied && best
						? `${body} ${fmt(copy.winner.best, { name: view.name(best) })}`
						: body
				}
				trophy
			/>
			<Scoreboard
				scores={state.scores}
				target={state.target}
				showBars={false}
				label={copy.winner.list}
				players={(team) => view.teamMembers(team).map(view.name).join(", ")}
			/>
			<div className="mt-auto flex flex-col gap-3">
				<ErrorNotice message={actions.error} />
				{view.isHost ? (
					<>
						{state.packWillRunLow ? (
							<p className="rounded-xl bg-[var(--club-panel-strong)] px-3 py-2.5 text-sm text-[var(--club-text)]">
								{copy.winner.packReset}
							</p>
						) : null}
						<PrimaryButton
							busy={actions.pending === "playAgain"}
							busyLabel={copy.winner.restarting}
							disabled={actions.pending !== null}
							onClick={() => void actions.playAgain(false)}
						>
							{copy.winner.playAgain}
						</PrimaryButton>
						<SecondaryButton
							busy={actions.pending === "newTeams"}
							disabled={actions.pending !== null}
							onClick={() => void actions.playAgain(true)}
						>
							{copy.winner.newTeams}
						</SecondaryButton>
					</>
				) : (
					<p className="rounded-xl bg-[var(--club-panel-strong)] px-3 py-2.5 text-sm text-[var(--club-text)]">
						{fmt(copy.winner.waitForHost, { host: hostName })}
					</p>
				)}
				<SecondaryButton
					busy={actions.pending === "leave"}
					onClick={() => void backToArcade()}
				>
					{common.endScreen.backToArcade}
				</SecondaryButton>
			</div>
		</>
	);
}

function Headline({
	title,
	body,
	trophy,
}: {
	title: string;
	body: string;
	trophy?: boolean;
}) {
	return (
		<div className="flex flex-col items-center gap-3 pt-2 text-center">
			{trophy ? (
				<span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--club-amber-dim)] text-[var(--club-amber)]">
					<Trophy aria-hidden="true" className="h-8 w-8" />
				</span>
			) : null}
			<h1 className="club-title text-[40px] font-bold leading-tight text-[var(--club-text)]">
				{title}
			</h1>
			<p className="text-[var(--club-muted)]">{body}</p>
		</div>
	);
}
