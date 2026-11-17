/**
 * Beat the Clock's building blocks on the web: the header, buttons, timer,
 * scoreboard strip and notices, all from the club tokens (game hue amber,
 * actions cyan, danger rose).
 */
import { fmt, joinNames } from "@arcadeclub/core/i18n/format";
import { formatJoinCode } from "@arcadeclub/core/sessions";
import { AlertCircle, Loader2, Menu, Pause } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useMessages } from "#/lib/i18n";

export function useClockCopy() {
	return useMessages().games.beatTheClock;
}

/** Team names in the viewer's language, and lists of them. */
export function useTeamNames() {
	const copy = useClockCopy();
	return {
		team: (team: number) => copy.teams[team] ?? "",
		list: (teams: readonly number[]) =>
			joinNames(
				teams.map((team) => copy.teams[team] ?? ""),
				copy.and,
			),
		names: (names: readonly string[]) => joinNames(names, copy.and),
	};
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
	return (
		<Loader2
			aria-hidden="true"
			className={`${className} animate-spin motion-reduce:animate-none`}
		/>
	);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	busy?: boolean;
	busyLabel?: string;
};

function ButtonBody({
	busy,
	busyLabel,
	children,
}: {
	busy?: boolean;
	busyLabel?: string;
	children: ReactNode;
}) {
	return busy ? (
		<>
			<Spinner />
			{busyLabel ?? children}
		</>
	) : (
		children
	);
}

/** Cyan pill, the screen's main action. */
export function PrimaryButton({
	busy,
	busyLabel,
	className = "",
	children,
	disabled,
	...rest
}: ButtonProps) {
	return (
		<button
			type="button"
			disabled={disabled || busy}
			className={`inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[var(--club-cyan)] px-6 text-base font-extrabold text-[var(--club-on-accent)] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
			{...rest}
		>
			<ButtonBody busy={busy} busyLabel={busyLabel}>
				{children}
			</ButtonBody>
		</button>
	);
}

/** Outlined pill, the second choice under a primary. */
export function SecondaryButton({
	busy,
	busyLabel,
	className = "",
	children,
	disabled,
	...rest
}: ButtonProps) {
	return (
		<button
			type="button"
			disabled={disabled || busy}
			className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--club-line-strong)] px-6 font-bold text-[var(--club-text)] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
			{...rest}
		>
			<ButtonBody busy={busy} busyLabel={busyLabel}>
				{children}
			</ButtonBody>
		</button>
	);
}

/** Tinted pill for inline actions inside a card. */
export function TonalButton({
	busy,
	busyLabel,
	className = "",
	children,
	disabled,
	...rest
}: ButtonProps) {
	return (
		<button
			type="button"
			disabled={disabled || busy}
			className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--club-accent-dim)] px-4 text-sm font-bold text-[var(--club-cyan)] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
			{...rest}
		>
			<ButtonBody busy={busy} busyLabel={busyLabel}>
				{children}
			</ButtonBody>
		</button>
	);
}

/** Text action in cyan. */
export function QuietButton({
	className = "",
	children,
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			type="button"
			className={`inline-flex min-h-11 items-center justify-center px-3 font-bold text-[var(--club-cyan)] disabled:opacity-45 ${className}`}
			{...rest}
		>
			{children}
		</button>
	);
}

export function ErrorNotice({ message }: { message: string }) {
	if (!message) return null;
	return (
		<p
			role="alert"
			className="flex items-start gap-2 rounded-xl bg-[var(--club-danger-dim)] px-3 py-2.5 text-sm font-semibold text-[var(--club-danger)]"
		>
			<AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
			{message}
		</p>
	);
}

export function Card({
	children,
	className = "",
	...rest
}: {
	children: ReactNode;
	className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={`rounded-[18px] border border-[var(--club-line)] bg-[var(--club-surface)] ${className}`}
			{...rest}
		>
			{children}
		</div>
	);
}

export function TeamChip({ children }: { children: ReactNode }) {
	return (
		<span className="inline-flex items-center rounded-full bg-[var(--club-amber-dim)] px-3 py-1 text-sm font-bold text-[var(--club-amber)]">
			{children}
		</span>
	);
}

/**
 * The header on every room screen: the menu button (pause icon for the
 * host), the amber kicker, a meta line and the room code.
 */
export function ClockHeader({
	isHost,
	meta,
	joinCode,
	onMenu,
	menuOpen,
	menuButtonRef,
}: {
	isHost: boolean;
	meta: string;
	joinCode?: string;
	onMenu: () => void;
	menuOpen: boolean;
	menuButtonRef?: React.Ref<HTMLButtonElement>;
}) {
	const copy = useClockCopy();
	return (
		<header className="flex items-center gap-3">
			<button
				ref={menuButtonRef}
				type="button"
				aria-label={isHost ? copy.pause : copy.menuLabel}
				aria-haspopup="dialog"
				aria-expanded={menuOpen}
				onClick={onMenu}
				className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--club-line-strong)] bg-[var(--club-surface)] text-[var(--club-text)]"
			>
				{isHost ? (
					<Pause aria-hidden="true" className="h-5 w-5" />
				) : (
					<Menu aria-hidden="true" className="h-5 w-5" />
				)}
			</button>
			<div className="min-w-0 flex-1">
				<p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--club-amber)]">
					{copy.title}
				</p>
				<p className="text-sm text-[var(--club-muted)]">{meta}</p>
			</div>
			{joinCode ? (
				<p className="shrink-0 text-right text-sm font-semibold tabular-nums text-[var(--club-muted)]">
					{fmt(copy.roomCode, { code: formatJoinCode(joinCode) })}
				</p>
			) : null}
		</header>
	);
}

/** Big countdown digits; red with "Last seconds" in the final 5 s. */
export function ClockTimer({
	seconds,
	size,
	timeUp,
	label,
}: {
	seconds: number;
	size: number;
	timeUp: boolean;
	label?: string;
}) {
	const copy = useClockCopy();
	const last = timeUp || seconds <= 5;
	const text = `0:${String(Math.max(0, seconds)).padStart(2, "0")}`;
	return (
		<div className="text-center">
			<p
				role="timer"
				aria-live="off"
				className={`club-title font-bold leading-none tabular-nums ${last ? "text-[var(--club-danger)]" : "text-[var(--club-amber)]"}`}
				style={{ fontSize: `min(${size / 16}rem, ${size * 1.5}px, 34vw)` }}
			>
				{text}
			</p>
			<p className="mt-1 text-sm font-semibold text-[var(--club-muted)]">
				{timeUp
					? copy.timer.up
					: seconds <= 5
						? copy.timer.last
						: (label ?? copy.timer.left)}
			</p>
		</div>
	);
}

/** The thin bar under the timer: seconds left out of the turn. */
export function TimeBar({
	seconds,
	total,
}: {
	seconds: number;
	total: number;
}) {
	const copy = useClockCopy();
	const last = seconds <= 5;
	return (
		<div
			role="progressbar"
			aria-label={copy.timer.bar}
			aria-valuemin={0}
			aria-valuemax={total}
			aria-valuenow={seconds}
			className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--club-panel-strong)]"
		>
			<div
				className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${last ? "bg-[var(--club-danger)]" : "bg-[var(--club-amber)]"}`}
				style={{ width: `${Math.max(0, Math.min(1, seconds / total)) * 100}%` }}
			/>
		</div>
	);
}

/** Announces 10 s, 5 s and time's up once each, for screen readers. */
export function TimerAnnouncer({
	seconds,
	timeUp,
}: {
	seconds: number;
	timeUp: boolean;
}) {
	const copy = useClockCopy();
	const [text, setText] = useState("");
	const said = useRef(new Set<string>());
	useEffect(() => {
		const say = (key: string, value: string) => {
			if (said.current.has(key)) return;
			said.current.add(key);
			setText(value);
		};
		if (timeUp) say("up", copy.timer.up);
		else if (seconds <= 5) say("5", copy.timer.announce5);
		else if (seconds <= 10) say("10", copy.timer.announce10);
	}, [seconds, timeUp, copy]);
	return (
		<p aria-live="polite" className="sr-only">
			{text}
		</p>
	);
}

/** The bottom strip: every team's score; the playing team amber with its pending gain. */
export function ScoreStrip({
	scores,
	playingTeam,
	pendingGain,
	myTeam,
}: {
	scores: readonly number[];
	playingTeam?: number;
	pendingGain?: number;
	myTeam?: number;
}) {
	const copy = useClockCopy();
	const teams = useTeamNames();
	const order = scores
		.map((_, team) => team)
		.sort((a, b) => (a === playingTeam ? -1 : b === playingTeam ? 1 : a - b));
	return (
		<ul
			aria-label={copy.score.list}
			className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-2"
		>
			{order.map((team) => {
				const playing = team === playingTeam;
				return (
					<li
						key={team}
						className={`flex min-w-0 flex-col rounded-xl border px-3 py-2 ${playing ? "border-[var(--club-amber)]" : "border-[var(--club-line)]"} bg-[var(--club-surface)]`}
					>
						<span className="truncate text-xs font-semibold text-[var(--club-muted)]">
							{team === myTeam
								? fmt(copy.opponent.yourTeam, { team: teams.team(team) })
								: teams.team(team)}
						</span>
						<span className="club-title whitespace-nowrap text-lg font-bold tabular-nums text-[var(--club-text)]">
							{scores[team]}
							{playing && pendingGain ? (
								<span className="ml-1 text-sm text-[var(--club-amber)]">
									{fmt(copy.score.gain, { n: pendingGain })}
								</span>
							) : null}
						</span>
					</li>
				);
			})}
		</ul>
	);
}

/** A "Reconnecting…" strip under the header, while the connection is down. */
export function OfflineStrip({ text }: { text: string }) {
	const [offline, setOffline] = useState(false);
	useEffect(() => {
		const update = () => setOffline(!navigator.onLine);
		update();
		window.addEventListener("online", update);
		window.addEventListener("offline", update);
		return () => {
			window.removeEventListener("online", update);
			window.removeEventListener("offline", update);
		};
	}, []);
	if (!offline) return null;
	return (
		<p
			role="status"
			className="flex items-center gap-2 rounded-xl bg-[var(--club-panel-strong)] px-3 py-2 text-sm text-[var(--club-muted)]"
		>
			<Spinner className="h-3.5 w-3.5" />
			{text}
		</p>
	);
}

/** A soft dot that pulses while someone else is about to act. */
export function PulseDot() {
	return (
		<span
			aria-hidden="true"
			className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--club-amber)] motion-safe:animate-pulse"
		/>
	);
}
