import { Chess } from "chess.js";
import { useMutation } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { FitScale } from "#/components/games/FitScale";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { GameEndScreen } from "#/components/games/GameEndScreen";
import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";
import {
	type ChessColor,
	type ChessGameResult,
	formatClockMs,
	getLegalMoves,
	getRemainingMs,
	isInCheck,
	isPromotionMove,
} from "#/lib/games/chess";
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
		whiteParticipantId?: Id<"sessionParticipants">;
		blackParticipantId?: Id<"sessionParticipants">;
		fen: string;
		sanHistory: string[];
		activeColor: ChessColor;
		timeControl: "untimed" | "10+0";
		remainingWhiteMs?: number;
		remainingBlackMs?: number;
		turnStartedAt?: number;
		drawOfferBy?: ChessColor;
		resultOutcome?: ChessGameResult["outcome"];
		resultWinner?: ChessColor;
		winnerParticipantId?: Id<"sessionParticipants">;
	} | null;
};

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
	const [participantId, setParticipantId] = useState<string>();
	const [selected, setSelected] = useState<string>();
	const [error, setError] = useState("");
	const [showInfo, setShowInfo] = useState(false);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		setParticipantId(
			window.sessionStorage.getItem("arcade-club.participantId") ?? undefined,
		);
	}, []);

	const state = bundle.state;
	const timed = state?.remainingWhiteMs !== undefined;

	useEffect(() => {
		if (!timed || state?.phase !== "active") {
			return;
		}
		const timer = setInterval(() => setNow(Date.now()), 500);
		return () => clearInterval(timer);
	}, [timed, state?.phase]);

	const localColor: ChessColor | undefined =
		state?.whiteParticipantId === participantId
			? "white"
			: state?.blackParticipantId === participantId
				? "black"
				: undefined;
	const opponentJoined = Boolean(
		state?.whiteParticipantId && state?.blackParticipantId,
	);
	const finished = state?.phase === "finished";
	const myTurn =
		Boolean(localColor) &&
		state?.activeColor === localColor &&
		opponentJoined &&
		!finished;

	const board = useMemo(
		() => (state ? new Chess(state.fen).board() : null),
		[state],
	);
	const legalTargets = useMemo(
		() => (state && selected ? getLegalMoves(state.fen, selected) : []),
		[state, selected],
	);

	if (!state || !board) {
		return (
			<FullscreenGameShell title={bundle.session.title}>
				<div className="flex h-full items-center justify-center text-slate-300">
					{chess.game.boardLoading}
				</div>
			</FullscreenGameShell>
		);
	}

	const white = bundle.participants.find(
		(participant) => participant._id === state.whiteParticipantId,
	);
	const black = bundle.participants.find(
		(participant) => participant._id === state.blackParticipantId,
	);
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

	async function run(action: () => Promise<unknown>, fallback: string) {
		setError("");
		try {
			await action();
		} catch (caught) {
			setError(getUserErrorMessage(caught, fallback));
		}
	}

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
						participantId: participantId as Id<"sessionParticipants">,
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
		<div className="grid gap-3 md:grid-cols-2">
			<PlayerCard
				label={chess.players.white}
				turnLabel={chess.players.turnBadge}
				name={white?.displayName ?? chess.players.openSeat}
				clock={timed ? formatClockMs(clockFor("white") ?? 0) : undefined}
				active={!finished && opponentJoined && state.activeColor === "white"}
				open={!white}
			/>
			<PlayerCard
				label={chess.players.black}
				turnLabel={chess.players.turnBadge}
				name={black?.displayName ?? chess.players.openSeat}
				clock={timed ? formatClockMs(clockFor("black") ?? 0) : undefined}
				active={!finished && opponentJoined && state.activeColor === "black"}
				open={!black}
			/>
		</div>
	);

	const drawOfferRow =
		state.drawOfferBy && !finished ? (
			<div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-200">
				{state.drawOfferBy === localColor ? (
					<span>{chess.drawOffer.waitingForOpponent}</span>
				) : localColor ? (
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
											participantId: participantId as Id<"sessionParticipants">,
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
											participantId: participantId as Id<"sessionParticipants">,
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
						onClick={() =>
							run(
								() =>
									offerDraw({
										sessionId: bundle.session._id,
										participantId: participantId as Id<"sessionParticipants">,
									}),
								chess.actions.offerDrawError,
							)
						}
					>
						{chess.actions.offerDraw}
					</button>
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
								chess.actions.resignError,
							)
						}
					>
						{chess.actions.resign}
					</button>
					{opponentFlagDown ? (
						<button
							type="button"
							className="rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950"
							onClick={() =>
								run(
									() =>
										claimTimeout({
											sessionId: bundle.session._id,
											participantId: participantId as Id<"sessionParticipants">,
										}),
									chess.actions.claimTimeoutError,
								)
							}
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
					onRematch={
						localColor
							? () =>
									run(
										() =>
											rematch({
												sessionId: bundle.session._id,
												participantId:
													participantId as Id<"sessionParticipants">,
											}),
										chess.endScreen.rematchError,
									)
							: undefined
					}
					rematchLabel={chess.endScreen.rematchLabel}
					newGameRoute="/chess/new"
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

	// Pre-game: waiting for the second seat — scrollable share screen.
	if (!opponentJoined) {
		return (
			<FullscreenGamePage
				title={bundle.session.title}
				maxWidthClassName="max-w-md"
			>
				<p className="club-kicker mb-2">{messages.catalog.chess.title}</p>
				<h1 className="club-title mb-4 text-3xl font-bold text-white">
					{bundle.session.title}
				</h1>
				<div className="space-y-4">
					<SeatBanner tone="warning" label={statusLabel} />
					{playerCards}
					{error ? <p className="text-sm text-orange-200">{error}</p> : null}
					<QrSharePanel label={chess.share.challengeLinkLabel} url={shareUrl} />
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
					{timed ? (
						<span className="rounded-xl bg-slate-900/70 px-3 py-2 text-xs font-bold tabular-nums text-slate-200 backdrop-blur">
							{formatClockMs(clockFor("white") ?? 0)} ·{" "}
							{formatClockMs(clockFor("black") ?? 0)}
						</span>
					) : null}
					<button
						type="button"
						onClick={() => setShowInfo((open) => !open)}
						className="flex h-11 items-center rounded-xl border border-white/20 bg-slate-900/70 px-4 text-sm font-bold text-white backdrop-blur"
					>
						{chess.info.button}
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
					<FitScale designWidth={560}>{boardGrid}</FitScale>
				</div>
				<div className="px-2 pb-2 text-sm sm:hidden">
					<p className="truncate text-center text-xs text-slate-300">
						{statusLabel}
					</p>
				</div>
				<div className="px-2 pb-2 empty:hidden">{actionRows}</div>
			</div>
			{showInfo ? (
				<div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm">
					<div className="h-full touch-pan-y overflow-y-auto overscroll-contain p-4 pt-16">
						<div className="mx-auto max-w-md space-y-4">
							<SeatBanner tone="success" label={statusLabel} />
							{playerCards}
							<QrSharePanel
								label={chess.share.challengeLinkLabel}
								url={shareUrl}
							/>
							<ParticipantList participants={bundle.participants} />
							{moveList}
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

function PlayerCard({
	label,
	turnLabel,
	name,
	clock,
	active = false,
	open = false,
}: {
	label: string;
	turnLabel: string;
	name: string;
	clock?: string;
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
				<p className="text-xs font-bold uppercase tracking-wide text-slate-400">
					{label}
				</p>
				{active ? (
					<span className="rounded-full bg-cyan-300/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
						{turnLabel}
					</span>
				) : null}
			</div>
			<div className="mt-1 flex items-center justify-between gap-3">
				<p className="truncate text-lg font-bold text-white">{name}</p>
				{clock ? (
					<p className="text-lg font-bold tabular-nums text-slate-200">
						{clock}
					</p>
				) : null}
			</div>
		</div>
	);
}
