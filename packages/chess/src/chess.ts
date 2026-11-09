import { GameRuleError } from "@arcadeclub/core/errors";
import { Chess } from "chess.js";
import type {
	ChessColor,
	ChessOutcome,
	ChessPromotion,
	ChessTimeControl,
} from "./enums";

type ChessMoveInput = {
	from: string;
	to: string;
	promotion?: ChessPromotion;
};

/** How a move can end the game: mate, or a draw the position forces. */
type ChessGameResult =
	| { outcome: "checkmate"; winner: ChessColor }
	| {
			outcome: Extract<
				ChessOutcome,
				| "stalemate"
				| "insufficientMaterial"
				| "threefoldRepetition"
				| "fiftyMoveRule"
			>;
	  };

type ChessMoveOutcome = {
	fen: string;
	san: string;
	activeColor: ChessColor;
	result?: ChessGameResult;
};

export const CHESS_INITIAL_FEN =
	"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const CHESS_TIME_CONTROLS: Record<
	ChessTimeControl,
	{ initialSeconds?: number }
> = {
	untimed: {},
	"10+0": { initialSeconds: 600 },
};

/** Both clocks at the start of a game; unset for an untimed one. */
export function initialClock(timeControl: ChessTimeControl) {
	const { initialSeconds } = CHESS_TIME_CONTROLS[timeControl];
	const ms = initialSeconds ? initialSeconds * 1000 : undefined;
	return { remainingWhiteMs: ms, remainingBlackMs: ms };
}

function detectDraw(game: Chess): ChessGameResult | undefined {
	if (game.isStalemate()) {
		return { outcome: "stalemate" };
	}
	if (game.isInsufficientMaterial()) {
		return { outcome: "insufficientMaterial" };
	}
	if (game.isThreefoldRepetition()) {
		return { outcome: "threefoldRepetition" };
	}
	if (game.isDrawByFiftyMoves()) {
		return { outcome: "fiftyMoveRule" };
	}
	return undefined;
}

/**
 * Validate and apply a move against a FEN. Throws a `GameRuleError` when the
 * move is illegal; the FEN is never modified.
 */
export function applyChessMove(
	fen: string,
	move: ChessMoveInput,
): ChessMoveOutcome {
	const game = new Chess(fen);
	let san: string;
	try {
		san = game.move({
			from: move.from,
			to: move.to,
			promotion: move.promotion,
		}).san;
	} catch {
		throw new GameRuleError("illegalMove");
	}
	let result: ChessGameResult | undefined;
	if (game.isCheckmate()) {
		// The side that just moved delivered mate.
		result = {
			outcome: "checkmate",
			winner: game.turn() === "w" ? "black" : "white",
		};
	} else {
		result = detectDraw(game);
	}
	return {
		fen: game.fen(),
		san,
		activeColor: game.turn() === "w" ? "white" : "black",
		result,
	};
}

export function getLegalMoves(fen: string, square: string): string[] {
	const game = new Chess(fen);
	return game
		.moves({
			square: square as Parameters<Chess["moves"]>[0]["square"],
			verbose: true,
		})
		.map((move) => move.to);
}

export function isPromotionMove(fen: string, from: string, to: string) {
	const game = new Chess(fen);
	const piece = game.get(from as Parameters<Chess["get"]>[0]);
	if (piece?.type !== "p") {
		return false;
	}
	const rank = to[1];
	return (
		(piece.color === "w" && rank === "8") ||
		(piece.color === "b" && rank === "1")
	);
}

export function isInCheck(fen: string) {
	return new Chess(fen).inCheck();
}

/** The position as rows of squares, rank 8 first. */
export function getChessBoard(fen: string) {
	return new Chess(fen).board();
}

export type ChessClockState = {
	remainingWhiteMs: number;
	remainingBlackMs: number;
	/** Timestamp when the active player's clock started running. */
	turnStartedAt: number;
};

/**
 * The clock of an active timed game, or undefined when the game is untimed or
 * not under way (no clock runs before the first move or after the end).
 */
export function runningClock(state: {
	phase: string;
	remainingWhiteMs?: number;
	remainingBlackMs?: number;
	turnStartedAt?: number;
}): ChessClockState | undefined {
	if (
		state.phase !== "active" ||
		state.remainingWhiteMs === undefined ||
		state.remainingBlackMs === undefined ||
		state.turnStartedAt === undefined
	) {
		return undefined;
	}
	return {
		remainingWhiteMs: state.remainingWhiteMs,
		remainingBlackMs: state.remainingBlackMs,
		turnStartedAt: state.turnStartedAt,
	};
}

/** Remaining ms for a color right now, given a running clock. */
export function getRemainingMs(
	clock: ChessClockState,
	activeColor: ChessColor,
	color: ChessColor,
	now: number,
) {
	const base =
		color === "white" ? clock.remainingWhiteMs : clock.remainingBlackMs;
	if (color !== activeColor) {
		return base;
	}
	return base - Math.max(0, now - clock.turnStartedAt);
}

/** Apply the elapsed thinking time to the mover's clock after a move. */
export function tickClockAfterMove(
	clock: ChessClockState,
	moverColor: ChessColor,
	now: number,
): ChessClockState {
	const elapsed = Math.max(0, now - clock.turnStartedAt);
	return {
		remainingWhiteMs:
			moverColor === "white"
				? clock.remainingWhiteMs - elapsed
				: clock.remainingWhiteMs,
		remainingBlackMs:
			moverColor === "black"
				? clock.remainingBlackMs - elapsed
				: clock.remainingBlackMs,
		turnStartedAt: now,
	};
}

export function hasFlagFallen(
	clock: ChessClockState,
	activeColor: ChessColor,
	now: number,
) {
	return getRemainingMs(clock, activeColor, activeColor, now) <= 0;
}

export function formatClockMs(ms: number) {
	const clamped = Math.max(0, Math.ceil(ms / 1000));
	const minutes = Math.floor(clamped / 60);
	const seconds = clamped % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
