import { describe, expect, it } from "vitest";
import {
	applyChessMove,
	CHESS_INITIAL_FEN,
	type ChessClockState,
	describeChessResult,
	formatClockMs,
	getActiveColorFromFen,
	getLegalMoves,
	getRemainingMs,
	hasFlagFallen,
	isInCheck,
	isPromotionMove,
	tickClockAfterMove,
} from "../chess";

describe("applyChessMove", () => {
	it("applies a legal opening move", () => {
		const outcome = applyChessMove(CHESS_INITIAL_FEN, {
			from: "e2",
			to: "e4",
		});
		expect(outcome.san).toBe("e4");
		expect(outcome.activeColor).toBe("black");
		expect(outcome.result).toBeUndefined();
	});

	it("rejects an illegal move without changing anything", () => {
		expect(() =>
			applyChessMove(CHESS_INITIAL_FEN, { from: "e2", to: "e5" }),
		).toThrow("Illegal move");
	});

	it("rejects moving the opponent's piece", () => {
		expect(() =>
			applyChessMove(CHESS_INITIAL_FEN, { from: "e7", to: "e5" }),
		).toThrow("Illegal move");
	});

	it("detects checkmate (fool's mate)", () => {
		let fen = CHESS_INITIAL_FEN;
		fen = applyChessMove(fen, { from: "f2", to: "f3" }).fen;
		fen = applyChessMove(fen, { from: "e7", to: "e5" }).fen;
		fen = applyChessMove(fen, { from: "g2", to: "g4" }).fen;
		const mate = applyChessMove(fen, { from: "d8", to: "h4" });
		expect(mate.result).toEqual({ outcome: "checkmate", winner: "black" });
		expect(mate.san).toBe("Qh4#");
	});

	it("detects stalemate", () => {
		// Black king a8, white queen to c7 is not stalemate; use classic position:
		// White: Kb6, Qc6; Black: Ka8 — black to move is stalemate after Qc7? No.
		// Simple known stalemate: black king h8, white king f7, white queen g6, black to move.
		const fen = "7k/5K2/6Q1/8/8/8/8/8 b - - 0 1";
		// Black has no legal move and is not in check — but we need to reach it via a move.
		// Instead verify via a white move into stalemate: queen g5->g6 from adjacent fen.
		const before = "7k/5K2/8/6Q1/8/8/8/8 w - - 0 1";
		const outcome = applyChessMove(before, { from: "g5", to: "g6" });
		expect(outcome.fen.split(" ")[0]).toBe(fen.split(" ")[0]);
		expect(outcome.result).toEqual({ outcome: "stalemate" });
	});

	it("detects insufficient material", () => {
		// King+rook vs king: capture the rook -> K vs K.
		const before = "8/8/8/8/2k5/8/2r5/2K5 w - - 0 1";
		const outcome = applyChessMove(before, { from: "c1", to: "c2" });
		expect(outcome.result).toEqual({ outcome: "insufficientMaterial" });
	});

	it("supports promotion", () => {
		const before = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
		const outcome = applyChessMove(before, {
			from: "a7",
			to: "a8",
			promotion: "q",
		});
		expect(outcome.san).toBe("a8=Q");
	});
});

describe("helpers", () => {
	it("lists legal moves for a square", () => {
		const moves = getLegalMoves(CHESS_INITIAL_FEN, "g1");
		expect(moves.sort()).toEqual(["f3", "h3"]);
	});

	it("returns no moves for an empty square", () => {
		expect(getLegalMoves(CHESS_INITIAL_FEN, "e4")).toEqual([]);
	});

	it("identifies promotion moves", () => {
		const fen = "8/P6k/8/8/8/8/8/K7 w - - 0 1";
		expect(isPromotionMove(fen, "a7", "a8")).toBe(true);
		expect(isPromotionMove(CHESS_INITIAL_FEN, "e2", "e4")).toBe(false);
	});

	it("reads the active color from a FEN", () => {
		expect(getActiveColorFromFen(CHESS_INITIAL_FEN)).toBe("white");
		const afterMove = applyChessMove(CHESS_INITIAL_FEN, {
			from: "e2",
			to: "e4",
		}).fen;
		expect(getActiveColorFromFen(afterMove)).toBe("black");
	});

	it("detects check", () => {
		const fen = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";
		expect(isInCheck(fen)).toBe(true);
		expect(isInCheck(CHESS_INITIAL_FEN)).toBe(false);
	});

	it("describes every result", () => {
		expect(
			describeChessResult({ outcome: "checkmate", winner: "white" }),
		).toContain("white");
		expect(describeChessResult({ outcome: "stalemate" })).toContain("Draw");
		expect(describeChessResult({ outcome: "drawAgreed" })).toContain("agreed");
	});
});

describe("clock", () => {
	const clock: ChessClockState = {
		remainingWhiteMs: 600_000,
		remainingBlackMs: 600_000,
		turnStartedAt: 1_000_000,
	};

	it("counts down only the active player's clock", () => {
		const now = 1_000_000 + 30_000;
		expect(getRemainingMs(clock, "white", "white", now)).toBe(570_000);
		expect(getRemainingMs(clock, "white", "black", now)).toBe(600_000);
	});

	it("charges the mover after a move and restarts the turn clock", () => {
		const now = 1_000_000 + 45_000;
		const next = tickClockAfterMove(clock, "white", now);
		expect(next.remainingWhiteMs).toBe(555_000);
		expect(next.remainingBlackMs).toBe(600_000);
		expect(next.turnStartedAt).toBe(now);
	});

	it("flags fall when the active clock reaches zero", () => {
		expect(hasFlagFallen(clock, "white", 1_000_000 + 599_999)).toBe(false);
		expect(hasFlagFallen(clock, "white", 1_000_000 + 600_000)).toBe(true);
	});

	it("formats clock times", () => {
		expect(formatClockMs(600_000)).toBe("10:00");
		expect(formatClockMs(61_000)).toBe("1:01");
		expect(formatClockMs(-5)).toBe("0:00");
	});
});
