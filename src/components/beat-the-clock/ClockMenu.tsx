/**
 * The room menu as a bottom sheet. Opening it never stops the clock; only
 * the host's Pause for everyone does. End game and Leave room confirm first.
 */

import { scoreLine } from "@arcadeclub/core/beat-the-clock-view";
import { fmt } from "@arcadeclub/core/i18n/format";
import { formatJoinCode } from "@arcadeclub/core/sessions";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ModerationActions } from "#/components/games/ModerationActions";
import {
	type ListedParticipant,
	ParticipantList,
} from "#/components/games/ParticipantList";
import { SessionHostControls } from "#/components/games/SessionHostControls";
import { useSessionModeration } from "#/components/games/useSessionModeration";
import { forgetSeat } from "#/lib/games/seat";
import { useGameAction } from "#/lib/games/use-game-action";
import { useMessages } from "#/lib/i18n";
import {
	ErrorNotice,
	SecondaryButton,
	useClockCopy,
	useTeamNames,
} from "./ClockBits";
import type { ClockScreenProps } from "./ClockRoom";

type Panel = "menu" | "howTo" | "switch" | "end" | "leave";

export function ClockMenu(props: ClockScreenProps & { onClose: () => void }) {
	const { bundle, view, actions, onClose } = props;
	const copy = useClockCopy();
	const common = useMessages().common;
	const teams = useTeamNames();
	const { state, session } = bundle;
	const [panel, setPanel] = useState<Panel>("menu");
	const sheet = useRef<HTMLDivElement>(null);
	const code = session.joinCode ? formatJoinCode(session.joinCode) : "";

	// The room re-renders every 250 ms while the clock runs, so the latest
	// onClose sits in a ref and focus moves only when the panel changes.
	const closeRef = useRef(onClose);
	closeRef.current = onClose;
	// biome-ignore lint/correctness/useExhaustiveDependencies: refocus when the panel changes
	useEffect(() => {
		sheet.current?.querySelector<HTMLElement>("button, a")?.focus();
	}, [panel]);
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeRef.current();
			if (event.key !== "Tab" || !sheet.current) return;
			// Keep Tab inside the sheet.
			const items = sheet.current.querySelectorAll<HTMLElement>(
				"button:not([disabled]), a[href]",
			);
			const first = items[0];
			const last = items[items.length - 1];
			if (!first || !last) return;
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const lobby = state.phase === "lobby";
	const finished = state.phase === "finished";
	const liveTurn =
		state.phase === "ready" ||
		state.phase === "describing" ||
		state.phase === "timeUp";
	const canSkip =
		liveTurn || (state.phase === "score" && state.roundOutcome === "none");
	const skipTeam = liveTurn
		? state.turn?.team
		: (view.upcoming?.team ?? undefined);
	const nextAfterSkip =
		skipTeam === undefined ? undefined : (skipTeam + 1) % state.teamCount;

	const close = () => onClose();

	const done = (ok: boolean) => {
		if (ok) close();
	};

	if (panel === "end") {
		return (
			<Confirm
				title={copy.end.title}
				body={fmt(
					liveTurn && state.phase !== "ready"
						? copy.end.body
						: copy.end.bodyBetweenTurns,
					{
						scores: scoreLine(state.scores, copy.teams),
					},
				)}
				confirm={copy.end.confirm}
				cancel={copy.end.cancel}
				busy={actions.pending === "end"}
				error={actions.error}
				onConfirm={async () => done(await actions.end())}
				onCancel={() => setPanel("menu")}
			/>
		);
	}
	if (panel === "leave") {
		return (
			<Confirm
				title={copy.leave.title}
				body={fmt(copy.leave.body, { code })}
				confirm={copy.leave.confirm}
				cancel={copy.leave.cancel}
				busy={actions.pending === "leave"}
				error={actions.error}
				onConfirm={async () => {
					if (await actions.leave()) {
						forgetSeat(session._id);
						window.location.href = "/";
					}
				}}
				onCancel={() => setPanel("menu")}
			/>
		);
	}

	return (
		<div className="fixed inset-0 z-30 flex items-end justify-center">
			<button
				type="button"
				aria-label={copy.menu.close}
				tabIndex={-1}
				className="absolute inset-0 bg-[rgba(2,6,23,0.7)] backdrop-blur-sm"
				onClick={close}
			/>
			<div
				ref={sheet}
				role="dialog"
				aria-modal="true"
				aria-labelledby="clock-menu-title"
				className="relative max-h-[85dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border border-[var(--club-line)] bg-[var(--club-surface)] p-5 pb-8 touch-pan-y"
			>
				<div className="mb-4 flex items-center justify-between">
					<h2
						id="clock-menu-title"
						className="club-title text-xl font-bold text-[var(--club-text)]"
					>
						{panel === "howTo"
							? copy.menu.howToPlay
							: panel === "switch"
								? copy.menu.switch
								: view.isHost
									? copy.menu.hostTitle
									: copy.menu.title}
					</h2>
					<button
						type="button"
						aria-label={copy.menu.close}
						onClick={close}
						className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--club-line-strong)] text-[var(--club-text)]"
					>
						<X aria-hidden="true" className="h-5 w-5" />
					</button>
				</div>

				{panel === "howTo" ? (
					<ol className="flex list-decimal flex-col gap-3 pl-5 text-[var(--club-text)]">
						{copy.howTo.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ol>
				) : panel === "switch" ? (
					<div className="flex flex-col gap-2">
						{Array.from({ length: state.teamCount }, (_, team) => team)
							.filter((team) => team !== (view.myPendingTeam ?? view.myTeam))
							.map((team) => (
								<SecondaryButton
									key={team}
									busy={actions.pending === `team-${team}`}
									onClick={async () => done(await actions.pickTeam(team))}
								>
									{fmt(copy.lobby.join, { team: teams.team(team) })}
								</SecondaryButton>
							))}
						<ErrorNotice message={actions.error} />
					</div>
				) : (
					<ul className="flex flex-col gap-1">
						{view.isHost && !lobby && !finished ? (
							<Item
								label={state.paused ? copy.menu.resume : copy.menu.pause}
								hint={state.paused ? copy.menu.resumeHint : copy.menu.pauseHint}
								onClick={async () =>
									done(
										await (state.paused ? actions.resume() : actions.pause()),
									)
								}
							/>
						) : null}
						{view.isHost && canSkip && nextAfterSkip !== undefined ? (
							<Item
								label={copy.menu.skip}
								hint={fmt(copy.menu.skipHint, {
									team: teams.team(nextAfterSkip),
								})}
								onClick={async () => done(await actions.skip())}
							/>
						) : null}
						<Item
							label={copy.menu.howToPlay}
							onClick={() => setPanel("howTo")}
						/>
						{!view.isHost &&
						!view.isWatcher &&
						!lobby &&
						!finished &&
						view.myTeam !== undefined &&
						!(liveTurn && view.role === "describer") ? (
							<Item
								label={copy.menu.switch}
								hint={
									view.switchBlocked
										? copy.menu.switchBlocked
										: copy.menu.switchHint
								}
								disabled={view.switchBlocked}
								onClick={() => setPanel("switch")}
							/>
						) : null}
						{view.isHost && !lobby && !finished ? (
							<Item
								label={copy.menu.end}
								hint={copy.menu.endHint}
								danger
								onClick={() => setPanel("end")}
							/>
						) : null}
						{!view.isHost && !finished ? (
							<Item
								label={copy.menu.leave}
								hint={fmt(copy.menu.leaveHint, { code })}
								danger
								onClick={() => setPanel("leave")}
							/>
						) : null}
						{view.isHost && lobby ? (
							<li className="mt-3 flex flex-col gap-3">
								<HostModeration {...props} />
								<Link
									to="/"
									className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--club-line-strong)] font-bold text-[var(--club-text)]"
								>
									{common.gameShell.returnToGames}
								</Link>
							</li>
						) : null}
						<li>
							<ErrorNotice message={actions.error} />
						</li>
					</ul>
				)}
			</div>
		</div>
	);
}

function Item({
	label,
	hint,
	danger,
	disabled,
	onClick,
}: {
	label: string;
	hint?: string;
	danger?: boolean;
	disabled?: boolean;
	onClick: () => void;
}) {
	return (
		<li>
			<button
				type="button"
				disabled={disabled}
				onClick={onClick}
				className="flex min-h-14 w-full flex-col items-start justify-center rounded-xl px-3 py-2 text-left hover:bg-[var(--club-panel-strong)] disabled:opacity-45"
			>
				<span
					className={`font-bold ${danger ? "text-[var(--club-danger)]" : "text-[var(--club-text)]"}`}
				>
					{label}
				</span>
				{hint ? (
					<span className="text-sm text-[var(--club-muted)]">{hint}</span>
				) : null}
			</button>
		</li>
	);
}

/** Rename, lock and kick: the existing session controls, in the lobby menu. */
function HostModeration({ bundle }: ClockScreenProps) {
	const { session } = bundle;
	const moderation = useSessionModeration(
		session._id,
		session.hostParticipantId,
	);
	const { error, run } = useGameAction();
	const messages = useMessages();
	if (!moderation) return null;
	return (
		<>
			<SessionHostControls
				moderation={moderation}
				title={session.title}
				locked={Boolean(session.locked)}
			/>
			<ParticipantList
				participants={bundle.participants as ListedParticipant[]}
				renderActions={(participant) => (
					<ModerationActions
						participant={participant}
						onTransferHost={() =>
							void run(
								() => moderation.transferHost(participant._id),
								messages.common.errors.somethingWentWrong,
							)
						}
						onKick={() =>
							void run(
								() => moderation.kick(participant._id),
								messages.common.errors.somethingWentWrong,
							)
						}
					/>
				)}
			/>
			<ErrorNotice message={error} />
		</>
	);
}

function Confirm({
	title,
	body,
	confirm,
	cancel,
	busy,
	error,
	onConfirm,
	onCancel,
}: {
	title: string;
	body: ReactNode;
	confirm: string;
	cancel: string;
	busy: boolean;
	error: string;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	const first = useRef<HTMLButtonElement>(null);
	useEffect(() => first.current?.focus(), []);
	return (
		<div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(2,6,23,0.7)] p-4 backdrop-blur-sm">
			<div
				role="alertdialog"
				aria-modal="true"
				aria-labelledby="clock-confirm-title"
				aria-describedby="clock-confirm-body"
				className="w-full max-w-sm rounded-3xl border border-[var(--club-line)] bg-[var(--club-surface)] p-5"
			>
				<h2
					id="clock-confirm-title"
					className="club-title text-xl font-bold text-[var(--club-text)]"
				>
					{title}
				</h2>
				<p id="clock-confirm-body" className="mt-2 text-[var(--club-muted)]">
					{body}
				</p>
				<div className="mt-5 flex flex-col gap-2">
					<ErrorNotice message={error} />
					<button
						ref={first}
						type="button"
						disabled={busy}
						onClick={onConfirm}
						className="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[var(--club-danger)] font-extrabold text-[var(--club-on-danger)] disabled:opacity-45"
					>
						{confirm}
					</button>
					<SecondaryButton onClick={onCancel}>{cancel}</SecondaryButton>
				</div>
			</div>
		</div>
	);
}
