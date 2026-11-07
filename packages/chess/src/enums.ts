/**
 * The chess values stored by Convex, apart from `chess.ts` so the schema can
 * read them without loading chess.js.
 */
export const CHESS_COLORS = ["white", "black"] as const;
export type ChessColor = (typeof CHESS_COLORS)[number];

export const CHESS_PHASES = ["waiting", "active", "finished"] as const;

export const CHESS_TIME_CONTROL_IDS = ["untimed", "10+0"] as const;
export type ChessTimeControl = (typeof CHESS_TIME_CONTROL_IDS)[number];

export const CHESS_OUTCOMES = [
	"checkmate",
	"timeout",
	"resignation",
	"stalemate",
	"insufficientMaterial",
	"threefoldRepetition",
	"fiftyMoveRule",
	"drawAgreed",
] as const;

export const CHESS_PROMOTIONS = ["q", "r", "b", "n"] as const;
export type ChessPromotion = (typeof CHESS_PROMOTIONS)[number];
