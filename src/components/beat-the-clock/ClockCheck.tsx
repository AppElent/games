/**
 * The referee check: the other teams flag words the describer said and
 * confirm; the describing team watches the result come in. After the check
 * confirms, every phone keeps this screen for 2 s before the score.
 */
import { CLOCK_CHECK_MS, turnGain } from "@arcadeclub/core/beat-the-clock";
import { fmt, plural } from "@arcadeclub/core/i18n/format";
import { Flag } from "lucide-react";
import { useI18n } from "#/lib/i18n";
import {
	Card,
	ErrorNotice,
	PrimaryButton,
	SecondaryButton,
	useClockCopy,
	useTeamNames,
} from "./ClockBits";
import type { ClockScreenProps } from "./ClockRoom";

function useCheck({ bundle, now }: ClockScreenProps) {
	const { state } = bundle;
	const turn = state.turn;
	const words = bundle.words ?? [];
	const ticks = turn?.ticks ?? [];
	const flags = turn?.flags ?? [];
	const done = state.phase !== "checking";
	const left =
		state.paused && state.pausedRemaining !== undefined
			? Math.ceil(state.pausedRemaining / 1000)
			: Math.max(
					0,
					Math.ceil(((state.deadline ?? now + CLOCK_CHECK_MS) - now) / 1000),
				);
	const gain = turn ? turnGain({ ...turn, words: [] }) : 0;
	return { state, turn, words, ticks, flags, done, left, gain };
}

export function ClockCheck(props: ClockScreenProps) {
	return props.view.role === "opponent" ? (
		<RefereeCheck {...props} />
	) : (
		<CheckingView {...props} />
	);
}

function RefereeCheck(props: ClockScreenProps) {
	const { view, actions } = props;
	const copy = useClockCopy();
	const { locale } = useI18n();
	const teams = useTeamNames();
	const { state, turn, words, ticks, flags, done, left, gain } =
		useCheck(props);
	if (!turn) return null;
	const team = teams.team(turn.team);
	const busy = actions.pending === "confirm";
	const guessed = words.flatMap((_, index) => (ticks[index] ? [index] : []));
	const missed = words.flatMap((word, index) => (ticks[index] ? [] : [word]));

	return (
		<>
			<div>
				<h1 className="club-title text-[26px] font-bold text-[var(--club-text)]">
					{fmt(copy.check.title, { team })}
				</h1>
				<p className="mt-1 text-[var(--club-muted)]">
					{fmt(copy.check.body, { describer: view.describerName })}
				</p>
			</div>
			{guessed.length === 0 ? (
				<Card className="p-4 text-[var(--club-muted)]">{copy.check.none}</Card>
			) : (
				<ul className="flex flex-col gap-2">
					{guessed.map((index) => {
						const flagged = Boolean(flags[index]);
						const word = words[index];
						return (
							<li
								key={word}
								className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-2 ${flagged ? "border-transparent bg-[var(--club-danger-dim)]" : "border-[var(--club-line)] bg-[var(--club-surface)]"}`}
							>
								<span className="min-w-0 flex-1">
									<span
										className={`block text-lg font-bold ${flagged ? "text-[var(--club-danger)] line-through" : "text-[var(--club-text)]"}`}
									>
										{word}
									</span>
									{flagged ? (
										<span className="text-sm font-semibold text-[var(--club-danger)]">
											{copy.check.flagged}
										</span>
									) : null}
								</span>
								{done ? null : (
									<button
										type="button"
										aria-pressed={flagged}
										aria-label={fmt(
											flagged ? copy.check.undoAria : copy.check.flagAria,
											{ word },
										)}
										disabled={busy || state.paused}
										onClick={() => void actions.flag(index, !flagged)}
										className="inline-flex min-h-11 items-center gap-1.5 rounded-full club-btn-outline px-4 text-sm font-bold text-[var(--club-text)] disabled:opacity-45"
									>
										{flagged ? null : (
											<Flag aria-hidden="true" className="h-4 w-4" />
										)}
										{flagged ? copy.check.undo : copy.check.flag}
									</button>
								)}
							</li>
						);
					})}
				</ul>
			)}
			{missed.length > 0 ? (
				<div>
					<p className="text-xs font-bold uppercase tracking-wide text-[var(--club-muted)]">
						{copy.check.missed}
					</p>
					<p className="mt-1 text-[var(--club-muted)]">{missed.join(" · ")}</p>
				</div>
			) : null}
			<div className="mt-auto flex flex-col gap-3">
				<ErrorNotice message={actions.error} />
				{done ? (
					<p
						role="status"
						className="text-center font-semibold text-[var(--club-text)]"
					>
						{turn.autoConfirmed
							? fmt(plural(locale, turn.gain ?? 0, copy.check.autoDone), {
									team,
								})
							: fmt(plural(locale, turn.gain ?? 0, copy.check.confirmedBy), {
									team,
									name: view.name(turn.confirmedBy),
								})}
					</p>
				) : (
					<>
						<p
							className="text-center text-sm text-[var(--club-muted)]"
							aria-live="off"
						>
							{fmt(copy.check.auto, { s: left })}
						</p>
						<PrimaryButton
							busy={busy}
							busyLabel={copy.check.confirming}
							disabled={state.paused}
							onClick={() => void actions.confirm()}
						>
							{plural(locale, gain, copy.check.confirm)}
						</PrimaryButton>
					</>
				)}
			</div>
		</>
	);
}

/** The describing team (and watchers) while the referees check. */
function CheckingView(props: ClockScreenProps) {
	const { view, actions } = props;
	const copy = useClockCopy();
	const teams = useTeamNames();
	const { turn, words, ticks, flags, done, left, gain } = useCheck(props);
	if (!turn) return null;
	const referees = teams.list(view.otherTeams);
	const watching = view.role !== "describer" && view.role !== "teammate";
	const title = watching
		? done
			? copy.checking.doneWatch
			: fmt(copy.checking.titleWatch, {
					referees,
					team: teams.team(turn.team),
				})
		: done
			? turn.autoConfirmed
				? copy.checking.autoDone
				: fmt(copy.checking.done, { team: referees })
			: fmt(copy.checking.title, { team: referees });
	const guessed = words.flatMap((_, index) => (ticks[index] ? [index] : []));

	return (
		<>
			{!done ? (
				<p className="text-sm font-semibold text-[var(--club-amber)]">
					{fmt(copy.checking.auto, { s: left })}
				</p>
			) : null}
			<h1 className="club-title text-[26px] font-bold text-[var(--club-text)]">
				{title}
			</h1>
			<ul aria-label={copy.checking.list} className="flex flex-col gap-2">
				{guessed.map((index) => {
					const flaggedBy = flags[index];
					return (
						<li
							key={words[index]}
							className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 py-2 ${flaggedBy ? "border-transparent bg-[var(--club-danger-dim)]" : "border-[var(--club-line)] bg-[var(--club-surface)]"}`}
						>
							<span
								className={`flex-1 text-lg font-bold ${flaggedBy ? "text-[var(--club-danger)] line-through" : "text-[var(--club-text)]"}`}
							>
								{words[index]}
							</span>
							<span
								className={`text-sm font-semibold ${flaggedBy ? "text-[var(--club-danger)]" : done ? "text-[var(--club-amber)]" : "text-[var(--club-muted)]"}`}
							>
								{flaggedBy
									? fmt(copy.checking.flaggedBy, { name: view.name(flaggedBy) })
									: done
										? copy.checking.counts
										: copy.checking.pending}
							</span>
						</li>
					);
				})}
			</ul>
			<Card className="flex items-center justify-between p-4">
				<span className="font-semibold text-[var(--club-muted)]">
					{copy.checking.thisTurn}
				</span>
				<span className="club-title text-2xl font-bold tabular-nums text-[var(--club-amber)]">
					{fmt(copy.score.gain, { n: done ? (turn.gain ?? gain) : gain })}
				</span>
			</Card>
			<div className="mt-auto flex flex-col gap-3">
				<ErrorNotice message={actions.error} />
				{done ? (
					<SecondaryButton onClick={props.onSeeScores}>
						{copy.checking.seeScores}
					</SecondaryButton>
				) : watching ? null : (
					<p className="text-center text-sm text-[var(--club-muted)]">
						{fmt(copy.checking.footer, { team: referees })}
					</p>
				)}
			</div>
		</>
	);
}
