/**
 * The lobby (host and players) and the late-join team picker. Everyone,
 * the host included, picks a team by tapping its card.
 */
import { lobbyReady } from "@arcadeclub/core/beat-the-clock";
import { fmt, plural } from "@arcadeclub/core/i18n/format";
import { formatJoinCode } from "@arcadeclub/core/sessions";
import { Check, Share2, Users } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useI18n } from "#/lib/i18n";
import { canShareLinks, shareLink } from "#/lib/share-link";
import { useCopyFeedback } from "#/lib/use-copy-feedback";
import {
	Card,
	ErrorNotice,
	PrimaryButton,
	PulseDot,
	TeamChip,
	TonalButton,
	useClockCopy,
	useTeamNames,
} from "./ClockBits";
import type { ClockScreenProps } from "./ClockRoom";

export function ClockLobby(props: ClockScreenProps) {
	const { bundle, view, actions } = props;
	const copy = useClockCopy();
	const { locale } = useI18n();
	const teams = useTeamNames();
	const { state, session } = bundle;
	const hostName = view.name(session.hostParticipantId);
	const ready = lobbyReady(
		{ ...state, deck: [], used: [], turn: undefined },
		view.players.map((p) => p._id),
	);
	const alone = view.players.length <= 1 && view.isHost;
	const myTeam = view.myTeam;

	return (
		<>
			{view.isHost ? (
				<>
					<h1 className="club-title text-[26px] font-bold text-[var(--club-text)]">
						{copy.lobby.title}
					</h1>
					<CodeCard joinCode={session.joinCode} joinUrl={props.joinUrl} />
				</>
			) : (
				<div>
					<h1 className="club-title text-[26px] font-bold text-[var(--club-text)]">
						{view.isWatcher
							? copy.lobby.title
							: myTeam === undefined
								? copy.lobby.pickTitle
								: fmt(copy.lobby.onTeamTitle, { team: teams.team(myTeam) })}
					</h1>
					<p className="mt-1 text-[var(--club-muted)]">
						{view.isWatcher
							? copy.lobby.watching
							: myTeam === undefined
								? copy.lobby.pickBody
								: fmt(copy.lobby.onTeamBody, { host: hostName })}
					</p>
				</div>
			)}

			{alone ? (
				<Card className="flex flex-col items-center gap-2 p-6 text-center">
					<Users
						aria-hidden="true"
						className="h-8 w-8 text-[var(--club-muted)]"
					/>
					<p className="font-bold text-[var(--club-text)]">
						{copy.lobby.emptyTitle}
					</p>
					<p className="text-sm text-[var(--club-muted)]">
						{copy.lobby.emptyBody}
					</p>
				</Card>
			) : (
				<TeamCards {...props} />
			)}

			{view.unassigned.length > 0 || (view.isHost && !alone) ? (
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="min-w-0 flex-1 text-sm text-[var(--club-muted)]">
						{view.unassigned.length > 0
							? fmt(copy.lobby.noTeam, {
									names: teams.names(view.unassigned.map((p) => p.displayName)),
								})
							: null}
					</p>
					{view.isHost ? (
						<TonalButton
							busy={actions.pending === "shuffle"}
							onClick={() => void actions.shuffleTeams()}
						>
							{copy.lobby.shuffle}
						</TonalButton>
					) : null}
				</div>
			) : null}

			<div className="mt-auto flex flex-col gap-3 pt-2">
				<ErrorNotice message={actions.error} />
				{view.isHost ? (
					<>
						{!ready ? (
							<p className="text-center text-sm text-[var(--club-muted)]">
								{copy.lobby.need}
							</p>
						) : null}
						<PrimaryButton
							disabled={!ready}
							busy={actions.pending === "start"}
							busyLabel={copy.lobby.starting}
							onClick={() => void actions.start()}
						>
							{copy.lobby.start}
						</PrimaryButton>
					</>
				) : (
					<p
						role="status"
						className="flex items-center justify-center gap-2 text-sm text-[var(--club-muted)]"
					>
						<PulseDot />
						{myTeam === undefined && !view.isWatcher
							? copy.lobby.statusPick
							: fmt(copy.lobby.statusWaiting, { host: hostName })}
					</p>
				)}
				<p className="sr-only">
					{plural(locale, view.players.length, copy.lobby.teamCount)}
				</p>
			</div>
		</>
	);
}

/** A player joining a game in progress: pick a team, play from its next turn. */
export function ClockLate(props: ClockScreenProps) {
	const { bundle, view } = props;
	const copy = useClockCopy();
	const teams = useTeamNames();
	const picked = view.myPendingTeam ?? view.myTeam;
	const playing = bundle.state.turn?.team;
	return (
		<>
			<div>
				<h1 className="club-title text-[26px] font-bold text-[var(--club-text)]">
					{copy.lobby.lateTitle}
				</h1>
				<p className="mt-1 text-[var(--club-muted)]">
					{picked === undefined
						? fmt(copy.lobby.lateBody, { turn: bundle.state.turnNumber })
						: copy.lobby.lateOnTeamBody}
				</p>
			</div>
			<TeamCards {...props} />
			<div className="mt-auto flex flex-col gap-3">
				<ErrorNotice message={props.actions.error} />
				<p
					role="status"
					className="flex items-center justify-center gap-2 text-center text-sm text-[var(--club-muted)]"
				>
					<PulseDot />
					{picked === undefined
						? copy.lobby.statusPick
						: fmt(copy.lobby.statusLate, {
								team: teams.team(playing ?? 0),
							})}
				</p>
			</div>
		</>
	);
}

/** The team cards: tap one to join it. Two columns, one below 340px. */
function TeamCards({ bundle, view, actions }: ClockScreenProps) {
	const copy = useClockCopy();
	const { locale } = useI18n();
	const teams = useTeamNames();
	const { state } = bundle;
	const mine = view.myPendingTeam ?? view.myTeam;
	const canPick = !view.isWatcher;
	return (
		<ul className="grid grid-cols-1 gap-3 min-[340px]:grid-cols-2">
			{teamNumbers(state.teamCount).map((team) => {
				const ids = [
					...view.teamMembers(team),
					...state.pending
						.filter((p) => p.team === team)
						.map((p) => p.participantId),
				];
				const selected = mine === team;
				return (
					<li key={team}>
						<button
							type="button"
							disabled={!canPick || actions.pending !== null}
							aria-pressed={selected}
							onClick={() => {
								if (!selected) void actions.pickTeam(team);
							}}
							className={`flex h-full w-full flex-col gap-2 rounded-[18px] border bg-[var(--club-surface)] p-3 text-left disabled:cursor-default ${selected ? "border-2 border-[var(--club-cyan)]" : "border-[var(--club-line)]"}`}
						>
							<span className="flex items-center justify-between gap-2">
								<TeamChip>{teams.team(team)}</TeamChip>
								{selected ? (
									<span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--club-cyan)] text-[var(--club-on-accent)]">
										<Check aria-hidden="true" className="h-4 w-4" />
									</span>
								) : (
									<span className="text-xs text-[var(--club-muted)]">
										{plural(locale, ids.length, copy.lobby.teamCount)}
									</span>
								)}
							</span>
							<span className="flex flex-col">
								{ids.map((id) => (
									<span
										key={id}
										className="flex min-h-9 items-center text-[15px] font-semibold text-[var(--club-text)]"
									>
										{id === bundle.viewerId
											? fmt(copy.lobby.you, { name: view.name(id) })
											: view.name(id)}
									</span>
								))}
							</span>
							{canPick && !selected ? (
								<span className="mt-auto text-sm font-bold text-[var(--club-cyan)]">
									{actions.pending === `team-${team}`
										? "…"
										: mine === undefined
											? fmt(copy.lobby.join, { team: teams.team(team) })
											: copy.lobby.switch}
								</span>
							) : null}
						</button>
					</li>
				);
			})}
		</ul>
	);
}

/** The room code, Share invite and Show QR. */
function CodeCard({
	joinCode,
	joinUrl,
}: {
	joinCode?: string;
	joinUrl: string;
}) {
	const copy = useClockCopy();
	const [showQr, setShowQr] = useState(false);
	const [qr, setQr] = useState("");
	const { copied, copy: copyLink } = useCopyFeedback();
	const [canShare, setCanShare] = useState(false);
	useEffect(() => setCanShare(canShareLinks()), []);
	useEffect(() => {
		if (!showQr || !joinUrl) return;
		let active = true;
		void QRCode.toDataURL(joinUrl, { margin: 1, width: 192 }).then((src) => {
			if (active) setQr(src);
		});
		return () => {
			active = false;
		};
	}, [showQr, joinUrl]);
	const code = joinCode ? formatJoinCode(joinCode) : "";

	return (
		<Card className="flex flex-col items-center gap-3 p-4">
			<p className="text-xs font-bold uppercase tracking-wide text-[var(--club-muted)]">
				{copy.lobby.roomCodeLabel}
			</p>
			<p className="club-title text-4xl font-bold tracking-[8px] tabular-nums text-[var(--club-text)]">
				{code}
			</p>
			{showQr && qr ? (
				<img
					src={qr}
					alt={fmt(copy.lobby.qrAlt, { code })}
					className="h-24 w-24 rounded-lg bg-white p-1"
				/>
			) : null}
			<div className="flex w-full gap-2">
				<TonalButton
					className="flex-1"
					onClick={async () => {
						if (
							!canShare ||
							(await shareLink(joinUrl, copy.title)) === "unavailable"
						) {
							await copyLink(joinUrl);
						}
					}}
				>
					<Share2 aria-hidden="true" className="h-4 w-4" />
					{copied ? copy.lobby.linkCopied : copy.lobby.share}
				</TonalButton>
				<TonalButton
					className="flex-1"
					aria-pressed={showQr}
					onClick={() => setShowQr((value) => !value)}
				>
					{showQr ? copy.lobby.hideQr : copy.lobby.showQr}
				</TonalButton>
			</div>
		</Card>
	);
}

function teamNumbers(count: number) {
	return Array.from({ length: count }, (_, team) => team);
}
