import { GameRuleError } from "./errors";

export const CONNECT_FOUR_COLORS = ["red", "yellow"] as const;
export type ConnectFourColor = (typeof CONNECT_FOUR_COLORS)[number];

export const CONNECT_FOUR_CELLS = [...CONNECT_FOUR_COLORS, "empty"] as const;
type ConnectFourCell = (typeof CONNECT_FOUR_CELLS)[number];

export const CONNECT_FOUR_PHASES = ["waiting", "active", "finished"] as const;
export const CONNECT_FOUR_OUTCOMES = [
	"connect",
	"draw",
	"resignation",
] as const;

export const CONNECT_FOUR_COLS = 7;
export const CONNECT_FOUR_ROWS = 6;

/** Flat board, index = row * cols + col, row 0 is the TOP row. */
export type ConnectFourBoard = ConnectFourCell[];

export function createConnectFourBoard(): ConnectFourBoard {
	return Array(CONNECT_FOUR_COLS * CONNECT_FOUR_ROWS).fill("empty");
}

export function getCell(board: ConnectFourBoard, row: number, col: number) {
	return board[row * CONNECT_FOUR_COLS + col];
}

/**
 * Drop a disc into a column. Returns the new board and landing row.
 * Throws on invalid column or full column; the input board is not mutated.
 */
export function applyConnectFourDrop(
	board: ConnectFourBoard,
	color: ConnectFourColor,
	col: number,
): { board: ConnectFourBoard; row: number } {
	if (!Number.isInteger(col) || col < 0 || col >= CONNECT_FOUR_COLS) {
		throw new GameRuleError("invalidColumn");
	}
	for (let row = CONNECT_FOUR_ROWS - 1; row >= 0; row -= 1) {
		if (getCell(board, row, col) === "empty") {
			const next = [...board];
			next[row * CONNECT_FOUR_COLS + col] = color;
			return { board: next, row };
		}
	}
	throw new GameRuleError("columnFull");
}

const DIRECTIONS = [
	[0, 1], // horizontal
	[1, 0], // vertical
	[1, 1], // diagonal down-right
	[1, -1], // diagonal down-left
] as const;

export function getConnectFourWinner(
	board: ConnectFourBoard,
): ConnectFourColor | "draw" | undefined {
	for (let row = 0; row < CONNECT_FOUR_ROWS; row += 1) {
		for (let col = 0; col < CONNECT_FOUR_COLS; col += 1) {
			const cell = getCell(board, row, col);
			if (cell === "empty") {
				continue;
			}
			for (const [dr, dc] of DIRECTIONS) {
				let count = 1;
				while (count < 4) {
					const r = row + dr * count;
					const c = col + dc * count;
					if (
						r < 0 ||
						r >= CONNECT_FOUR_ROWS ||
						c < 0 ||
						c >= CONNECT_FOUR_COLS ||
						getCell(board, r, c) !== cell
					) {
						break;
					}
					count += 1;
				}
				if (count === 4) {
					return cell;
				}
			}
		}
	}
	return board.every((cell) => cell !== "empty") ? "draw" : undefined;
}

export function isColumnFull(board: ConnectFourBoard, col: number) {
	return getCell(board, 0, col) !== "empty";
}
