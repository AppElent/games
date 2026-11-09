import {
	CONNECT_FOUR_COLS,
	CONNECT_FOUR_ROWS,
	type ConnectFourColor,
	getCell,
	isColumnFull,
} from "@arcadeclub/core/connect-four";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { GameEndScreen } from "#/components/games/GameEndScreen";
import { GameInfoOverlay } from "#/components/games/match/GameInfoOverlay";
import {
	MatchHud,
	MatchLoading,
	MatchStage,
	MatchStatusPill,
} from "#/components/games/match/MatchStage";
import { MatchWaitingScreen } from "#/components/games/match/MatchWaitingScreen";
import {
	SeatCard,
	SeatCards,
	SeatName,
} from "#/components/games/match/SeatCard";
import { getGameRoute } from "#/lib/games/catalog";
import { useSeat } from "#/lib/games/seat";
import { useGameAction } from "#/lib/games/use-game-action";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

type Bundle = NonNullable<FunctionReturnType<typeof api.connectFour.getBundle>>;

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
	const participantId = useSeat(bundle.session._id);
	const { error, run } = useGameAction();
	const [showInfo, setShowInfo] = useState(false);

	const state = bundle.state;
	if (!state) {
		return (
			<MatchLoading
				title={bundle.session.title}
				text={connectFour.game.boardLoading}
			/>
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
					participantId,
					column,
				}),
			connectFour.actions.dropError,
		);
	}

	const discCards = (
		<SeatCards>
			<SeatCard
				icon={<Disc color="red" />}
				label={connectFour.players.red}
				turnLabel={connectFour.players.turnBadge}
				active={!finished && opponentJoined && state.activeColor === "red"}
				open={!red}
			>
				<SeatName name={red?.displayName ?? connectFour.players.openSeat} />
			</SeatCard>
			<SeatCard
				icon={<Disc color="yellow" />}
				label={connectFour.players.yellow}
				turnLabel={connectFour.players.turnBadge}
				active={!finished && opponentJoined && state.activeColor === "yellow"}
				open={!yellow}
			>
				<SeatName name={yellow?.displayName ?? connectFour.players.openSeat} />
			</SeatCard>
		</SeatCards>
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
			{participantId && localColor && !finished && opponentJoined ? (
				<button
					type="button"
					className="rounded-md border border-orange-300/40 bg-orange-300/10 px-4 py-2 text-sm font-bold text-orange-100"
					onClick={() =>
						run(
							() =>
								resign({
									sessionId: bundle.session._id,
									participantId,
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
				participantId && localColor
					? () =>
							run(
								() =>
									rematch({
										sessionId: bundle.session._id,
										participantId,
									}),
								connectFour.endScreen.rematchError,
							)
					: undefined
			}
			rematchLabel={connectFour.endScreen.rematchLabel}
			newGameRoute={getGameRoute("connect-four")}
		/>
	) : null;

	if (!opponentJoined) {
		return (
			<MatchWaitingScreen
				title={bundle.session.title}
				gameTitle={messages.catalog["connect-four"].title}
				status={statusLabel}
				seats={discCards}
				error={error}
				shareLabel={connectFour.share.challengeLinkLabel}
				shareUrl={shareUrl}
				participants={bundle.participants}
			/>
		);
	}

	return (
		<FullscreenGameShell
			title={bundle.session.title}
			hud={
				<MatchHud
					infoLabel={connectFour.info.button}
					onInfo={() => setShowInfo((open) => !open)}
				>
					<MatchStatusPill status={statusLabel} />
				</MatchHud>
			}
		>
			<MatchStage board={board} designWidth={480} error={error}>
				<p className="truncate px-2 pb-1 text-center text-xs text-slate-300 sm:hidden">
					{statusLabel}
				</p>
				<div className="px-2 pb-2">{actionRow}</div>
				{endScreen ? (
					<div className="mx-auto w-full max-w-md px-2 pb-3">{endScreen}</div>
				) : null}
			</MatchStage>
			{showInfo ? (
				<GameInfoOverlay
					status={statusLabel}
					seats={discCards}
					shareLabel={connectFour.share.challengeLinkLabel}
					shareUrl={shareUrl}
					participants={bundle.participants}
					onClose={() => setShowInfo(false)}
				/>
			) : null}
		</FullscreenGameShell>
	);
}

function Disc({ color }: { color: ConnectFourColor }) {
	return (
		<span
			className={`inline-block h-3 w-3 rounded-full ${
				color === "red" ? "bg-red-500" : "bg-yellow-400"
			}`}
		/>
	);
}
