/**
 * The running turn, by role: the describer's words and ticks, the teammates'
 * big timer and dots, the referees' read-only card, and the watchers' view.
 */
import { secondsLeft } from "@arcadeclub/core/beat-the-clock";
import { fmt, plural } from "@arcadeclub/core/i18n/format";
import { Check } from "lucide-react";
import { useI18n } from "#/lib/i18n";
import {
	Card,
	ClockTimer,
	ErrorNotice,
	OfflineStrip,
	PrimaryButton,
	PulseDot,
	QuietButton,
	ScoreStrip,
	TeamChip,
	TimeBar,
	TimerAnnouncer,
	useClockCopy,
	useTeamNames,
} from "./ClockBits";
import type { ClockScreenProps } from "./ClockRoom";

export function ClockTurn(props: ClockScreenProps) {
	const { view } = props;
	if (view.role === "describer") return <DescriberTurn {...props} />;
	if (view.role === "opponent") return <OpponentTurn {...props} />;
	return <TeammateTurn {...props} />;
}

function useTurn({ bundle, now }: ClockScreenProps) {
	const { state } = bundle;
	const turn = state.turn;
	const ticks = turn?.ticks ?? [];
	return {
		state,
		turn,
		ticks,
		ticked: ticks.filter(Boolean).length,
		seconds: secondsLeft(state, now),
		ready: state.phase === "ready",
		timeUp: state.phase === "timeUp",
	};
}

function DescriberTurn(props: ClockScreenProps) {
	const { bundle, view, actions } = props;
	const copy = useClockCopy();
	const { locale } = useI18n();
	const teams = useTeamNames();
	const { state, turn, ticks, ticked, seconds, ready, timeUp } = useTurn(props);
	if (!turn) return null;
	const guessers = view.guesserIds.map(view.name);
	const opponents = teams.list(view.otherTeams);

	if (ready) {
		return (
			<>
				<div className="flex flex-1 flex-col items-start gap-3 pt-6">
					<TeamChip>{teams.team(turn.team)}</TeamChip>
					<h1 className="club-title text-[34px] font-bold leading-tight text-[var(--club-text)]">
						{copy.describer.readyTitle}
					</h1>
					<p className="text-[var(--club-muted)]">
						{fmt(
							guessers.length > 1
								? copy.describer.readyBodyMany
								: copy.describer.readyBody,
							{ guessers: teams.names(guessers), opponents },
						)}
					</p>
				</div>
				<ErrorNotice message={actions.error} />
				<PrimaryButton
					className="min-h-16 text-xl"
					disabled={state.paused}
					busy={actions.pending === "go"}
					onClick={() => void actions.go()}
				>
					{copy.describer.go}
				</PrimaryButton>
			</>
		);
	}

	const words = bundle.words ?? [];
	return (
		<>
			<OfflineStrip text={copy.describer.offline} />
			<div className="sticky top-0 z-[1] flex flex-col gap-2 bg-slate-950 pb-2">
				<ClockTimer seconds={seconds} size={96} timeUp={timeUp} />
				<TimeBar seconds={seconds} total={state.turnSeconds} />
				<TimerAnnouncer seconds={seconds} timeUp={timeUp} />
			</div>
			<p className="text-sm text-[var(--club-muted)]">
				{timeUp
					? fmt(copy.describer.hintUp, { opponents })
					: copy.describer.hint}
			</p>
			<ol className="flex flex-col gap-2">
				{words.map((word, index) => {
					const on = ticks[index] ?? false;
					const locked = timeUp && !on;
					return (
						<li key={word}>
							<button
								type="button"
								aria-pressed={on}
								disabled={locked || state.paused}
								onClick={() => void actions.tick(index, !on)}
								className={`flex min-h-[60px] w-full items-center gap-3 rounded-xl border px-4 text-left ${on ? "border-transparent bg-[var(--club-amber-dim)]" : "border-[var(--club-line)]"} disabled:opacity-60`}
							>
								<span className="w-5 text-sm font-bold tabular-nums text-[var(--club-muted)]">
									{index + 1}
								</span>
								<span className="flex-1 text-[21px] font-bold leading-tight text-[var(--club-text)]">
									{word}
								</span>
								<span
									className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${on ? "bg-[var(--club-amber)] text-[var(--club-on-amber)]" : "border-2 border-[var(--club-line-strong)]"}`}
								>
									{on ? <Check aria-hidden="true" className="h-5 w-5" /> : null}
								</span>
							</button>
						</li>
					);
				})}
			</ol>
			<ErrorNotice message={actions.error} />
			<div className="mt-auto flex flex-col items-center gap-2">
				{timeUp ? (
					<PrimaryButton
						busy={actions.pending === "send"}
						busyLabel={copy.describer.sending}
						disabled={state.paused}
						onClick={() => void actions.send()}
					>
						{fmt(plural(locale, ticked, copy.describer.send), { opponents })}
					</PrimaryButton>
				) : (
					<>
						<p className="text-sm font-semibold text-[var(--club-muted)]">
							{fmt(copy.guessedCount, { n: ticked })}
						</p>
						<QuietButton
							disabled={actions.pending === "send" || state.paused}
							onClick={() => void actions.send()}
						>
							{copy.describer.endEarly}
						</QuietButton>
					</>
				)}
			</div>
			<ScoreStrip
				scores={state.scores}
				playingTeam={turn.team}
				pendingGain={ticked}
				myTeam={view.myTeam}
			/>
		</>
	);
}

function TeammateTurn(props: ClockScreenProps) {
	const { view } = props;
	const copy = useClockCopy();
	const teams = useTeamNames();
	const { state, turn, ticks, ticked, seconds, ready, timeUp } = useTurn(props);
	if (!turn) return null;
	const watching = view.isWatcher || view.role !== "teammate";
	const describer = view.describerName;
	const chip = watching
		? fmt(copy.watcher.team, { team: teams.team(turn.team), describer })
		: fmt(copy.teammate.team, { describer });

	return (
		<>
			<OfflineStrip text={copy.teammate.offline} />
			<div className="flex flex-1 flex-col items-center gap-4 pt-4 text-center">
				<TeamChip>{chip}</TeamChip>
				{ready ? (
					<>
						<PulseDot />
						<h1 className="club-title text-[34px] font-bold leading-tight text-[var(--club-text)]">
							{watching
								? fmt(copy.opponent.upTitle, { team: teams.team(turn.team) })
								: copy.teammate.readyTitle}
						</h1>
						<p className="text-[var(--club-muted)]">
							{watching
								? fmt(copy.opponent.upBody, { describer })
								: fmt(copy.teammate.readyBody, { describer })}
						</p>
					</>
				) : (
					<>
						<ClockTimer
							seconds={seconds}
							size={136}
							timeUp={timeUp}
							label=" "
						/>
						<TimeBar seconds={seconds} total={state.turnSeconds} />
						<TimerAnnouncer seconds={seconds} timeUp={timeUp} />
						<p className="text-lg font-bold text-[var(--club-text)]">
							{timeUp
								? fmt(copy.waitSend, { describer })
								: watching
									? copy.watcher.watching
									: copy.teammate.guess}
						</p>
						<div
							role="img"
							aria-label={fmt(copy.teammate.dots, { n: ticked })}
							className="flex gap-2"
						>
							{ticks.map((on, index) => (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: five fixed slots
									key={index}
									className={`h-4 w-4 rounded-full ${on ? "bg-[var(--club-amber)]" : "border-2 border-[var(--club-line-strong)]"}`}
								/>
							))}
						</div>
						<p className="text-sm font-semibold text-[var(--club-muted)]">
							{fmt(copy.guessedCount, { n: ticked })}
						</p>
					</>
				)}
			</div>
			<ScoreStrip
				scores={state.scores}
				playingTeam={turn.team}
				pendingGain={ready ? 0 : ticked}
				myTeam={view.myTeam}
			/>
		</>
	);
}

function OpponentTurn(props: ClockScreenProps) {
	const { bundle, view } = props;
	const copy = useClockCopy();
	const teams = useTeamNames();
	const { state, turn, ticks, ticked, seconds, ready, timeUp } = useTurn(props);
	if (!turn) return null;
	const describer = view.describerName;
	const guessers = view.guesserIds.map(view.name);
	const team = teams.team(turn.team);
	const words = bundle.words ?? [];
	const last = !ready && !timeUp && seconds <= 5;

	return (
		<>
			<OfflineStrip text={copy.opponent.offline} />
			<div className="flex items-center gap-4">
				<div className="text-center">
					<p
						role="timer"
						aria-live="off"
						className={`club-title text-[64px] font-bold leading-none tabular-nums ${timeUp || last ? "text-[var(--club-danger)]" : "text-[var(--club-amber)]"}`}
					>
						{`0:${String(seconds).padStart(2, "0")}`}
					</p>
				</div>
				<div className="min-w-0 flex-1">
					<h1 className="club-title text-xl font-bold text-[var(--club-text)]">
						{ready
							? fmt(copy.opponent.upTitle, { team })
							: fmt(copy.opponent.busyTitle, { team })}
					</h1>
					<p className="text-sm text-[var(--club-muted)]">
						{ready
							? fmt(copy.opponent.upBody, { describer })
							: timeUp
								? copy.timer.up
								: last
									? copy.timer.last
									: fmt(
											guessers.length > 1
												? copy.opponent.busyBodyMany
												: copy.opponent.busyBody,
											{ describer, guessers: teams.names(guessers) },
										)}
					</p>
				</div>
			</div>
			{!ready ? <TimerAnnouncer seconds={seconds} timeUp={timeUp} /> : null}
			<p className="rounded-xl bg-[var(--club-panel-strong)] px-3 py-2.5 text-sm text-[var(--club-text)]">
				{fmt(copy.opponent.referee, { describer })}
			</p>
			{ready || words.length === 0 ? (
				<Card className="p-5 text-center text-sm text-[var(--club-muted)]">
					{fmt(copy.opponent.cardSoon, { describer })}
				</Card>
			) : (
				<ol
					aria-label={fmt(copy.opponent.card, { team })}
					className="flex flex-col gap-2"
				>
					{words.map((word, index) => (
						<li
							key={word}
							className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 ${ticks[index] ? "border-transparent bg-[var(--club-amber-dim)]" : "border-[var(--club-line)]"}`}
						>
							<span className="flex-1 text-lg font-bold text-[var(--club-text)]">
								{word}
							</span>
							{ticks[index] ? (
								<span className="flex items-center gap-1 text-sm font-bold text-[var(--club-amber)]">
									<Check aria-hidden="true" className="h-4 w-4" />
									{copy.opponent.guessed}
								</span>
							) : null}
						</li>
					))}
				</ol>
			)}
			{timeUp ? (
				<p className="text-center text-sm text-[var(--club-muted)]">
					{fmt(copy.waitSend, { describer })}
				</p>
			) : null}
			<div className="mt-auto">
				<ScoreStrip
					scores={state.scores}
					playingTeam={turn.team}
					pendingGain={ready ? 0 : ticked}
					myTeam={view.myTeam}
				/>
			</div>
		</>
	);
}
