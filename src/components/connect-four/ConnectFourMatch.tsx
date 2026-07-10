import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { FitScale } from "#/components/games/FitScale";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { GameEndScreen } from "#/components/games/GameEndScreen";
import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";
import {
	CONNECT_FOUR_COLS,
	CONNECT_FOUR_ROWS,
	type ConnectFourCell,
	type ConnectFourColor,
	getCell,
	isColumnFull,
} from "#/lib/games/connect-four";
import { getUserErrorMessage } from "#/lib/games/errors";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Participant = {
	_id: Id<"sessionParticipants">;
	displayName: string;
	role: "host" | "player" | "watcher";
	seat?: string;
	connected: boolean;
};

type Bundle = {
	session: {
		_id: Id<"gameSessions">;
		title: string;
		shareToken?: string;
	};
	participants: Participant[];
	state: {
		phase: "waiting" | "active" | "finished";
		redParticipantId?: Id<"sessionParticipants">;
		yellowParticipantId?: Id<"sessionParticipants">;
		board: ConnectFourCell[];
		activeColor: ConnectFourColor;
		resultOutcome?: "connect" | "draw" | "resignation";
		resultWinner?: ConnectFourColor;
	} | null;
};

export function ConnectFourMatch({
	bundle,
	shareUrl,
}: {
	bundle: Bundle;
	shareUrl: string;
}) {
	const messages = useMessages();
	const connectFour = messages.games.connectFour;
	const drop = useMutation(api.connectFour.drop);
	const resign = useMutation(api.connectFour.resign);
	const rematch = useMutation(api.connectFour.rematch);
	const [participantId, setParticipantId] = useState<string>();
	const [error, setError] = useState("");
	const [showInfo, setShowInfo] = useState(false);

	useEffect(() => {
		setParticipantId(
			window.sessionStorage.getItem("arcade-club.participantId") ?? undefined,
		);
	}, []);

	const state = bundle.state;
	if (!state) {
		return (
			<FullscreenGameShell title={bundle.session.title}>
				<div className="flex h-full items-center justify-center text-slate-300">
					{connectFour.game.boardLoading}
				</div>
			</FullscreenGameShell>
		);
	}

	const red = bundle.participants.find(
		(participant) => participant._id === state.redParticipantId,
	);
	const yellow = bundle.participants.find(
		(participant) => participant._id === state.yellowParticipantId,
	);
	const localColor: ConnectFourColor | undefined =
		state.redParticipantId === participantId
			? "red"
			: state.yellowParticipantId === participantId
				? "yellow"
				: undefined;
	const opponentJoined = Boolean(
		state.redParticipantId && state.yellowParticipantId,
	);
	const finished = state.phase === "finished";
	const myTurn =
		Boolean(localColor) &&
		state.activeColor === localColor &&
		opponentJoined &&
		!finished;

	const statusLabel = finished
		? state.resultOutcome === "draw"
			? connectFour.status.draw
			: fmt(
					state.resultOutcome === "resignation"
						? connectFour.status.winsByResignation
						: connectFour.status.wins,
					{
						name:
							state.resultWinner === "red"
								? (red?.displayName ?? connectFour.status.winnerFallbackRed)
								: (yellow?.displayName ??
									connectFour.status.winnerFallbackYellow),
					},
				)
		: !opponentJoined
			? connectFour.status.waitingForOpponent
			: myTurn
				? connectFour.status.yourMove
				: fmt(connectFour.status.waitingFor, {
						name:
							state.activeColor === "red"
								? (red?.displayName ?? connectFour.players.red)
								: (yellow?.displayName ?? connectFour.players.yellow),
					});

	async function run(action: () => Promise<unknown>, fallback: string) {
		setError("");
		try {
			await action();
		} catch (caught) {
			setError(getUserErrorMessage(caught, fallback));
		}
	}

	function handleDrop(column: number) {
		if (
			!myTurn ||
			!participantId ||
			!state ||
			isColumnFull(state.board, column)
		) {
			return;
		}
		run(
			() =>
				drop({
					sessionId: bundle.session._id,
					participantId: participantId as Id<"sessionParticipants">,
					column,
				}),
			connectFour.actions.dropError,
		);
	}

	const discCards = (
		<div className="grid gap-3 md:grid-cols-2">
			<DiscCard
				color="red"
				label={connectFour.players.red}
				turnLabel={connectFour.players.turnBadge}
				name={red?.displayName ?? connectFour.players.openSeat}
				active={!finished && opponentJoined && state.activeColor === "red"}
				open={!red}
			/>
			<DiscCard
				color="yellow"
				label={connectFour.players.yellow}
				turnLabel={connectFour.players.turnBadge}
				name={yellow?.displayName ?? connectFour.players.openSeat}
				active={!finished && opponentJoined && state.activeColor === "yellow"}
				open={!yellow}
			/>
		</div>
	);

	const board = (
		<div className="rounded-xl border border-white/10 bg-sky-950/60 p-3">
			<div className="grid grid-cols-7 gap-2">
				{Array.from({ length: CONNECT_FOUR_ROWS }).map((_, row) =>
					Array.from({ length: CONNECT_FOUR_COLS }).map((__, col) => {
						const cell = getCell(state.board, row, col);
						return (
							<button
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed grid
								key={`${row}-${col}`}
								type="button"
								aria-label={fmt(connectFour.game.dropInColumn, {
									column: col + 1,
								})}
								disabled={!myTurn || isColumnFull(state.board, col)}
								onClick={() => handleDrop(col)}
								className="flex aspect-square items-center justify-center rounded-full bg-black/40"
							>
								{cell !== "empty" ? (
									<span
										className={`block h-[85%] w-[85%] rounded-full ${
											cell === "red"
												? "bg-gradient-to-br from-red-400 to-red-600"
												: "bg-gradient-to-br from-yellow-300 to-amber-500"
										}`}
									/>
								) : (
									<span className="sr-only">{connectFour.game.emptyCell}</span>
								)}
							</button>
						);
					}),
				)}
			</div>
		</div>
	);

	const actionRow = (
		<div className="flex flex-wrap justify-center gap-3 empty:hidden">
			{localColor && !finished && opponentJoined ? (
				<button
					type="button"
					className="rounded-md border border-orange-300/40 bg-orange-300/10 px-4 py-2 text-sm font-bold text-orange-100"
					onClick={() =>
						run(
							() =>
								resign({
									sessionId: bundle.session._id,
									participantId: participantId as Id<"sessionParticipants">,
								}),
							connectFour.actions.resignError,
						)
					}
				>
					{connectFour.actions.resign}
				</button>
			) : null}
		</div>
	);

	const endScreen = finished ? (
		<GameEndScreen
			heading={statusLabel}
			shareText={fmt(connectFour.endScreen.shareText, { status: statusLabel })}
			onRematch={
				localColor
					? () =>
							run(
								() =>
									rematch({
										sessionId: bundle.session._id,
										participantId: participantId as Id<"sessionParticipants">,
									}),
								connectFour.endScreen.rematchError,
							)
					: undefined
			}
			rematchLabel={connectFour.endScreen.rematchLabel}
			newGameRoute="/connect-four/new"
		/>
	) : null;

	// Pre-game: waiting for the second seat — scrollable share screen.
	if (!opponentJoined) {
		return (
			<FullscreenGamePage
				title={bundle.session.title}
				maxWidthClassName="max-w-md"
			>
				<p className="club-kicker mb-2">
					{messages.catalog["connect-four"].title}
				</p>
				<h1 className="club-title mb-4 text-3xl font-bold text-white">
					{bundle.session.title}
				</h1>
				<div className="space-y-4">
					<SeatBanner tone="warning" label={statusLabel} />
					{discCards}
					{error ? <p className="text-sm text-orange-200">{error}</p> : null}
					<QrSharePanel
						label={connectFour.share.challengeLinkLabel}
						url={shareUrl}
					/>
					<ParticipantList participants={bundle.participants} />
				</div>
			</FullscreenGamePage>
		);
	}

	return (
		<FullscreenGameShell
			title={bundle.session.title}
			hud={
				<div className="flex items-center justify-end gap-2">
					<span className="hidden max-w-[40vw] truncate rounded-xl bg-slate-900/70 px-3 py-2 text-xs text-slate-200 backdrop-blur sm:inline">
						{statusLabel}
					</span>
					<button
						type="button"
						onClick={() => setShowInfo((open) => !open)}
						className="flex h-11 items-center rounded-xl border border-white/20 bg-slate-900/70 px-4 text-sm font-bold text-white backdrop-blur"
					>
						{connectFour.info.button}
					</button>
				</div>
			}
		>
			<div className="flex h-full flex-col">
				{error ? (
					<p className="px-4 pt-14 text-center text-xs text-orange-200">
						{error}
					</p>
				) : null}
				<div className={`min-h-0 flex-1 px-2 pb-1 ${error ? "pt-1" : "pt-14"}`}>
					<FitScale designWidth={480}>{board}</FitScale>
				</div>
				<p className="truncate px-2 pb-1 text-center text-xs text-slate-300 sm:hidden">
					{statusLabel}
				</p>
				<div className="px-2 pb-2">{actionRow}</div>
				{endScreen ? (
					<div className="mx-auto w-full max-w-md px-2 pb-3">{endScreen}</div>
				) : null}
			</div>
			{showInfo ? (
				<div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm">
					<div className="h-full touch-pan-y overflow-y-auto overscroll-contain p-4 pt-16">
						<div className="mx-auto max-w-md space-y-4">
							<SeatBanner tone="success" label={statusLabel} />
							{discCards}
							<QrSharePanel
								label={connectFour.share.challengeLinkLabel}
								url={shareUrl}
							/>
							<ParticipantList participants={bundle.participants} />
							<button
								type="button"
								onClick={() => setShowInfo(false)}
								className="w-full min-h-11 rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-bold text-white"
							>
								{messages.common.actions.close}
							</button>
						</div>
					</div>
				</div>
			) : null}
		</FullscreenGameShell>
	);
}

function DiscCard({
	color,
	label,
	turnLabel,
	name,
	active = false,
	open = false,
}: {
	color: ConnectFourColor;
	label: string;
	turnLabel: string;
	name: string;
	active?: boolean;
	open?: boolean;
}) {
	return (
		<div
			className={`rounded-lg border p-4 ${
				open
					? "border-dashed border-orange-300/40 bg-orange-300/10"
					: active
						? "border-cyan-300/40 bg-cyan-300/10"
						: "border-white/10 bg-white/5"
			}`}
		>
			<div className="flex items-center justify-between gap-3">
				<p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
					<span
						className={`inline-block h-3 w-3 rounded-full ${
							color === "red" ? "bg-red-500" : "bg-yellow-400"
						}`}
					/>
					{label}
				</p>
				{active ? (
					<span className="rounded-full bg-cyan-300/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
						{turnLabel}
					</span>
				) : null}
			</div>
			<p className="mt-1 truncate text-lg font-bold text-white">{name}</p>
		</div>
	);
}
