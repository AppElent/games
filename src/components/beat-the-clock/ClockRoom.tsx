/**
 * A Beat the Clock room on the web: one screen for everyone, which follows
 * the room's phase and this tab's role in it. The header's menu button opens
 * the game's own bottom sheet; the shell's pause overlay is not used.
 */

import {
	CLOCK_SCORE_DELAY_MS,
	secondsLeft,
} from "@arcadeclub/core/beat-the-clock";
import {
	type ClockView,
	clockTime,
	clockView,
} from "@arcadeclub/core/beat-the-clock-view";
import { fmt } from "@arcadeclub/core/i18n/format";
import { useRef, useState } from "react";
import { useNow } from "#/lib/use-now";
import { Card, ClockHeader, useClockCopy, useTeamNames } from "./ClockBits";
import { ClockCheck } from "./ClockCheck";
import { ClockLate, ClockLobby } from "./ClockLobby";
import { ClockMenu } from "./ClockMenu";
import { ClockScore, ClockTie, ClockWinner } from "./ClockResult";
import { ClockTurn } from "./ClockTurn";
import type { ClockActions, ClockBundle } from "./use-clock-room";

export type ClockScreenProps = {
	bundle: ClockBundle;
	view: ClockView;
	actions: ClockActions;
	now: number;
	joinUrl: string;
	/** Leave the confirmed check for the score now, not after 2 s. */
	onSeeScores: () => void;
};

export function ClockRoom({
	bundle,
	actions,
	joinUrl,
}: {
	bundle: ClockBundle;
	actions: ClockActions;
	joinUrl: string;
}) {
	const copy = useClockCopy();
	const teams = useTeamNames();
	const { state, session } = bundle;
	const timed =
		state.phase === "describing" ||
		state.phase === "timeUp" ||
		state.phase === "checking" ||
		state.phase === "score" ||
		state.notice !== undefined;
	const now = useNow(250, timed && !state.paused);
	const [seenCheck, setSeenCheck] = useState<number | null>(null);
	const view = clockView(
		state,
		bundle.participants,
		bundle.viewerId,
		session.hostParticipantId,
		seenCheck === state.turnNumber ? now + CLOCK_SCORE_DELAY_MS : now,
	);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuButton = useRef<HTMLButtonElement>(null);

	const meta =
		state.phase === "lobby"
			? fmt(copy.lobby.meta, {
					seconds: state.turnSeconds,
					target: state.target,
				})
			: view.screen === "check"
				? fmt(copy.meta.check, { turn: state.turnNumber })
				: state.phase === "score" && state.roundOutcome !== "none"
					? fmt(copy.meta.roundDone, {
							round: state.round,
							target: state.target,
						})
					: state.phase === "finished"
						? copy.winner.meta
						: fmt(copy.meta.turn, {
								turn: state.turnNumber,
								target: state.target,
							});

	const props: ClockScreenProps = {
		bundle,
		view,
		actions,
		now,
		joinUrl,
		onSeeScores: () => setSeenCheck(state.turnNumber),
	};
	const hostName = view.name(session.hostParticipantId);
	const running = state.phase === "describing" || state.phase === "timeUp";

	return (
		<div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col gap-4 px-5 pt-4 pb-6">
			<ClockHeader
				isHost={view.isHost}
				meta={meta}
				joinCode={session.joinCode}
				onMenu={() => setMenuOpen(true)}
				menuOpen={menuOpen}
				menuButtonRef={menuButton}
			/>
			{view.noticeActive && state.notice && state.phase === "ready" ? (
				<p
					role="status"
					className="rounded-xl bg-[var(--club-panel-strong)] px-3 py-2.5 text-sm text-[var(--club-text)]"
				>
					{state.notice.kind === "skipped"
						? fmt(copy.turn.skipped, {
								host: hostName,
								team: teams.team(state.turn?.team ?? 0),
							})
						: fmt(copy.turn.skippedShort, {
								team: teams.team(state.notice.team),
							})}
				</p>
			) : null}
			<div className="relative flex flex-1 flex-col gap-4">
				<Screen {...props} />
				{state.paused ? (
					<div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-[rgba(2,6,23,0.7)] p-2 pt-10 backdrop-blur-sm">
						<Card className="w-full max-w-sm p-5" role="status">
							<h2 className="club-title text-2xl font-bold text-[var(--club-text)]">
								{copy.paused.title}
							</h2>
							<p className="mt-2 text-[var(--club-muted)]">
								{running
									? fmt(copy.paused.body, {
											host: hostName,
											time: clockTime(secondsLeft(state, now)),
										})
									: fmt(copy.paused.bodyNoClock, { host: hostName })}
							</p>
							{view.isHost ? (
								<button
									type="button"
									disabled={actions.pending === "resume"}
									onClick={() => void actions.resume()}
									className="mt-4 inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--club-cyan)] font-extrabold text-[var(--club-on-accent)] disabled:opacity-45"
								>
									{copy.menu.resume}
								</button>
							) : null}
						</Card>
					</div>
				) : null}
			</div>
			{menuOpen ? (
				<ClockMenu
					{...props}
					onClose={() => {
						setMenuOpen(false);
						menuButton.current?.focus();
					}}
				/>
			) : null}
		</div>
	);
}

function Screen(props: ClockScreenProps) {
	switch (props.view.screen) {
		case "lobby":
			return <ClockLobby {...props} />;
		case "late":
			return <ClockLate {...props} />;
		case "turn":
			return <ClockTurn {...props} />;
		case "check":
			return <ClockCheck {...props} />;
		case "score":
			return <ClockScore {...props} />;
		case "tie":
			return <ClockTie {...props} />;
		case "finished":
			return <ClockWinner {...props} />;
	}
}
