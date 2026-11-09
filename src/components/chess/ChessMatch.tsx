import {
	formatClockMs,
	getChessBoard,
	getLegalMoves,
	getRemainingMs,
	isInCheck,
	isPromotionMove,
} from "@arcadeclub/chess/chess";
import { CHESS_COLORS, type ChessColor } from "@arcadeclub/chess/enums";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo, useState } from "react";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { GameEndScreen } from "#/components/games/GameEndScreen";
import { GameInfoOverlay } from "#/components/games/match/GameInfoOverlay";
import {
	MatchHud,
	MatchStage,
	MatchStatus,
} from "#/components/games/match/MatchStage";
import { MatchWaitingScreen } from "#/components/games/match/MatchWaitingScreen";
import { SeatCard, SeatCards } from "#/components/games/match/SeatCard";
import { useDuel } from "#/components/games/match/useDuel";
import { getGameRoute } from "#/lib/games/catalog";
import { fmt, useMessages } from "#/lib/i18n";
import { useNow } from "#/lib/use-now";
import { api } from "../../../convex/_generated/api";

type Bundle = NonNullable<FunctionReturnType<typeof api.chess.getBundle>>;

const PIECE_GLYPHS: Record<string, string> = {
	wp: "♙",
	wn: "♘",
	wb: "♗",
	wr: "♖",
	wq: "♕",
	wk: "♔",
	bp: "♟",
	bn: "♞",
	bb: "♝",
	br: "♜",
	bq: "♛",
	bk: "♚",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

export function ChessMatch({
	bundle,
	shareUrl,
}: {
	bundle: Bundle;
	shareUrl: string;
}) {
	const messages = useMessages();
	const chess = messages.games.chess;
	const applyMove = useMutation(api.chess.applyMove);
	const resign = useMutation(api.chess.resign);
	const offerDraw = useMutation(api.chess.offerDraw);
	const respondDraw = useMutation(api.chess.respondDraw);
	const claimTimeout = useMutation(api.chess.claimTimeout);
	const rematch = useMutation(api.chess.rematch);
	const [selected, setSelected] = useState<string>();
	const [showInfo, setShowInfo] = useState(false);
	const state = bundle.state;
	const {
		participantId,
		localColor,
		opponentJoined,
		finished,
		myTurn,
		occupant,
		isActive,
		seatAction,
		error,
		run,
	} = useDuel(bundle, CHESS_COLORS);
	const timed = state?.remainingWhiteMs !== undefined;
	const now = useNow(500, timed && state?.phase === "active");

	const board = useMemo(
		() => (state ? getChessBoard(state.fen) : null),
		[state],
	);
	const legalTargets = useMemo(
		() => (state && selected ? getLegalMoves(state.fen, selected) : []),
		[state, selected],
	);

	if (!state || !board) {
		return (
			<MatchStatus
				title={bundle.session.title}
				text={chess.game.boardLoading}
			/>
		);
	}

	const white = occupant("white");
	const black = occupant("black");
	const flipped = localColor === "black";
	const check = !finished && isInCheck(state.fen);

	function clockFor(color: ChessColor) {
		if (
			state?.remainingWhiteMs === undefined ||
			state.remainingBlackMs === undefined
		) {
			return undefined;
		}
		if (state.turnStartedAt === undefined || state.phase !== "active") {
			return color === "white"
				? state.remainingWhiteMs
				: state.remainingBlackMs;
		}
		return getRemainingMs(
			{
				remainingWhiteMs: state.remainingWhiteMs,
				remainingBlackMs: state.remainingBlackMs,
				turnStartedAt: state.turnStartedAt,
			},
			state.activeColor,
			color,
			now,
		);
	}

	const opponentFlagDown =
		timed &&
		!finished &&
		state.phase === "active" &&
		localColor &&
		state.activeColor !== localColor &&
		(clockFor(state.activeColor) ?? 1) <= 0;

	async function handleSquareClick(square: string, piece?: string) {
		if (!myTurn || !participantId || !state) {
			return;
		}
		const myPrefix = localColor === "white" ? "w" : "b";
		if (selected && legalTargets.includes(square)) {
			const from = selected;
			setSelected(undefined);
			await run(
				() =>
					applyMove({
						sessionId: bundle.session._id,
						participantId,
						from,
						to: square,
						promotion: isPromotionMove(state.fen, from, square)
							? "q"
							: undefined,
					}),
				chess.actions.moveError,
			);
			return;
		}
		if (piece?.startsWith(myPrefix)) {
			setSelected(square === selected ? undefined : square);
		} else {
			setSelected(undefined);
		}
	}

	const statusLabel = finished
		? state.resultOutcome
			? fmt(chess.status.result[state.resultOutcome], {
					winner:
						state.resultWinner === "white"
							? chess.players.colorWhite
							: chess.players.colorBlack,
				})
			: chess.status.gameOver
		: !opponentJoined
			? chess.status.waitingForOpponent
			: myTurn
				? check
					? chess.status.yourMoveCheck
					: chess.status.yourMove
				: fmt(check ? chess.status.waitingForCheck : chess.status.waitingFor, {
						name:
							state.activeColor === "white"
								? (white?.displayName ?? chess.players.colorWhite)
								: (black?.displayName ?? chess.players.colorBlack),
					});

	const rows = flipped ? [...board].reverse() : board;

	const playerCards = (
		<SeatCards>
			<SeatCard
				label={chess.players.white}
				active={isActive("white")}
				open={!white}
			>
				<NameAndClock
					name={white?.displayName ?? messages.common.match.openSeat}
					clock={timed ? formatClockMs(clockFor("white") ?? 0) : undefined}
				/>
			</SeatCard>
			<SeatCard
				label={chess.players.black}
				active={isActive("black")}
				open={!black}
			>
				<NameAndClock
					name={black?.displayName ?? messages.common.match.openSeat}
					clock={timed ? formatClockMs(clockFor("black") ?? 0) : undefined}
				/>
			</SeatCard>
		</SeatCards>
	);

	const drawOfferRow =
		state.drawOfferBy && !finished ? (
			<div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-200">
				{state.drawOfferBy === localColor ? (
					<span>{chess.drawOffer.waitingForOpponent}</span>
				) : localColor && participantId ? (
					<>
						<span>{chess.drawOffer.opponentOffers}</span>
						<button
							type="button"
							className="rounded-md bg-white px-3 py-1.5 font-bold text-slate-950"
							onClick={() =>
								run(
									() =>
										respondDraw({
											sessionId: bundle.session._id,
											participantId,
											accept: true,
										}),
									chess.drawOffer.acceptError,
								)
							}
						>
							{chess.drawOffer.accept}
						</button>
						<button
							type="button"
							className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 font-bold text-white"
							onClick={() =>
								run(
									() =>
										respondDraw({
											sessionId: bundle.session._id,
											participantId,
											accept: false,
										}),
									chess.drawOffer.declineError,
								)
							}
						>
							{chess.drawOffer.decline}
						</button>
					</>
				) : null}
			</div>
		) : null;

	const boardGrid = (
		<div className="w-full">
			<div className="grid grid-cols-8 overflow-hidden rounded-lg border border-white/10">
				{rows.map((row, rowIndex) => {
					const cells = flipped ? [...row].reverse() : row;
					return cells.map((cell, colIndex) => {
						const rank = flipped ? rowIndex + 1 : 8 - rowIndex;
						const file = FILES[flipped ? 7 - colIndex : colIndex];
						const square = `${file}${rank}`;
						const dark = (rowIndex + colIndex) % 2 === 1;
						const pieceKey = cell ? `${cell.color}${cell.type}` : undefined;
						const isSelected = selected === square;
						const isTarget = legalTargets.includes(square);
						return (
							<button
								key={square}
								type="button"
								aria-label={`${square}${pieceKey ? ` ${pieceKey}` : ""}`}
								onClick={() => handleSquareClick(square, pieceKey)}
								className={`relative flex aspect-square items-center justify-center text-2xl sm:text-4xl ${
									dark ? "bg-emerald-900/70" : "bg-emerald-100/20"
								} ${isSelected ? "ring-2 ring-inset ring-cyan-300" : ""} ${
									myTurn ? "cursor-pointer" : "cursor-default"
								}`}
							>
								{pieceKey ? (
									<span
										className={
											cell?.color === "w"
												? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]"
												: "text-slate-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.35)]"
										}
									>
										{PIECE_GLYPHS[pieceKey]}
									</span>
								) : null}
								{isTarget ? (
									<span
										className={`absolute rounded-full ${
											pieceKey
												? "inset-0 ring-4 ring-inset ring-cyan-300/70"
												: "h-3 w-3 bg-cyan-300/80"
										}`}
									/>
								) : null}
							</button>
						);
					});
				})}
			</div>
		</div>
	);

	const actionRows = (
		<>
			{drawOfferRow}
			{localColor && !finished && opponentJoined ? (
				<div className="flex flex-wrap justify-center gap-3">
					<button
						type="button"
						className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white"
						onClick={seatAction(offerDraw, chess.actions.offerDrawError)}
					>
						{chess.actions.offerDraw}
					</button>
					<button
						type="button"
						className="rounded-md border border-orange-300/40 bg-orange-300/10 px-4 py-2 text-sm font-bold text-orange-100"
						onClick={seatAction(resign, chess.actions.resignError)}
					>
						{chess.actions.resign}
					</button>
					{opponentFlagDown ? (
						<button
							type="button"
							className="rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950"
							onClick={seatAction(
								claimTimeout,
								chess.actions.claimTimeoutError,
							)}
						>
							{chess.actions.claimWinOnTime}
						</button>
					) : null}
				</div>
			) : null}
			{finished ? (
				<GameEndScreen
					heading={statusLabel}
					subtitle={
						localColor
							? state.resultWinner === localColor
								? chess.endScreen.youWin
								: state.resultWinner
									? chess.endScreen.betterLuck
									: undefined
							: undefined
					}
					shareText={fmt(chess.endScreen.shareText, {
						status: statusLabel,
						count: state.sanHistory.length,
					})}
					onRematch={seatAction(rematch, messages.common.match.rematchError)}
					newGameRoute={getGameRoute("chess")}
				/>
			) : null}
		</>
	);

	const moveList = (
		<div className="club-panel rounded-lg p-4">
			<p className="club-kicker mb-2">{chess.moveList.heading}</p>
			{state.sanHistory.length === 0 ? (
				<p className="text-sm text-slate-400">{chess.moveList.empty}</p>
			) : (
				<ol className="grid grid-cols-2 gap-x-4 text-sm text-slate-200">
					{state.sanHistory.map((san, index) => (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: move list is append-only
							key={`${index}-${san}`}
							className="tabular-nums"
						>
							{index % 2 === 0 ? `${index / 2 + 1}. ` : ""}
							{san}
						</li>
					))}
				</ol>
			)}
		</div>
	);

	if (!opponentJoined) {
		return (
			<MatchWaitingScreen
				title={bundle.session.title}
				gameTitle={messages.catalog.chess.title}
				status={statusLabel}
				seats={playerCards}
				error={error}
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
					status={statusLabel}
					onInfo={() => setShowInfo((open) => !open)}
				>
					{timed ? (
						<span className="rounded-xl bg-slate-900/70 px-3 py-2 text-xs font-bold tabular-nums text-slate-200 backdrop-blur">
							{formatClockMs(clockFor("white") ?? 0)} ·{" "}
							{formatClockMs(clockFor("black") ?? 0)}
						</span>
					) : null}
				</MatchHud>
			}
		>
			<MatchStage board={boardGrid} designWidth={560} error={error}>
				<div className="px-2 pb-2 text-sm sm:hidden">
					<p className="truncate text-center text-xs text-slate-300">
						{statusLabel}
					</p>
				</div>
				<div className="px-2 pb-2 empty:hidden">{actionRows}</div>
			</MatchStage>
			{showInfo ? (
				<GameInfoOverlay
					status={statusLabel}
					seats={playerCards}
					shareUrl={shareUrl}
					participants={bundle.participants}
					extra={moveList}
					onClose={() => setShowInfo(false)}
				/>
			) : null}
		</FullscreenGameShell>
	);
}

/** A chess seat's name, with its clock in timed games. */
function NameAndClock({ name, clock }: { name: string; clock?: string }) {
	return (
		<div className="mt-1 flex items-center justify-between gap-3">
			<p className="truncate text-lg font-bold text-white">{name}</p>
			{clock ? (
				<p className="text-lg font-bold tabular-nums text-slate-200">{clock}</p>
			) : null}
		</div>
	);
}
