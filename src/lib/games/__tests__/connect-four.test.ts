import { describe, expect, it } from "vitest";
import {
	applyConnectFourDrop,
	CONNECT_FOUR_COLS,
	CONNECT_FOUR_ROWS,
	type ConnectFourBoard,
	type ConnectFourColor,
	createConnectFourBoard,
	getCell,
	getConnectFourWinner,
	isColumnFull,
	switchConnectFourColor,
} from "../connect-four";

function play(moves: Array<[ConnectFourColor, number]>) {
	let board = createConnectFourBoard();
	for (const [color, col] of moves) {
		board = applyConnectFourDrop(board, color, col).board;
	}
	return board;
}

describe("applyConnectFourDrop", () => {
	it("drops to the bottom of an empty column", () => {
		const { board, row } = applyConnectFourDrop(
			createConnectFourBoard(),
			"red",
			3,
		);
		expect(row).toBe(CONNECT_FOUR_ROWS - 1);
		expect(getCell(board, CONNECT_FOUR_ROWS - 1, 3)).toBe("red");
	});

	it("stacks discs upward", () => {
		const board = play([
			["red", 0],
			["yellow", 0],
		]);
		expect(getCell(board, 5, 0)).toBe("red");
		expect(getCell(board, 4, 0)).toBe("yellow");
	});

	it("does not mutate the input board", () => {
		const board = createConnectFourBoard();
		applyConnectFourDrop(board, "red", 0);
		expect(board.every((cell) => cell === "empty")).toBe(true);
	});

	it("rejects out-of-range columns", () => {
		expect(() =>
			applyConnectFourDrop(createConnectFourBoard(), "red", -1),
		).toThrow("Invalid column");
		expect(() =>
			applyConnectFourDrop(createConnectFourBoard(), "red", CONNECT_FOUR_COLS),
		).toThrow("Invalid column");
		expect(() =>
			applyConnectFourDrop(createConnectFourBoard(), "red", 1.5),
		).toThrow("Invalid column");
	});

	it("rejects a full column", () => {
		let board: ConnectFourBoard = createConnectFourBoard();
		for (let i = 0; i < CONNECT_FOUR_ROWS; i += 1) {
			board = applyConnectFourDrop(
				board,
				i % 2 === 0 ? "red" : "yellow",
				2,
			).board;
		}
		expect(isColumnFull(board, 2)).toBe(true);
		expect(() => applyConnectFourDrop(board, "red", 2)).toThrow(
			"That column is full",
		);
	});
});

describe("getConnectFourWinner", () => {
	it("returns undefined for an empty or ongoing board", () => {
		expect(getConnectFourWinner(createConnectFourBoard())).toBeUndefined();
		expect(getConnectFourWinner(play([["red", 0]]))).toBeUndefined();
	});

	it("detects a horizontal win", () => {
		const board = play([
			["red", 0],
			["yellow", 0],
			["red", 1],
			["yellow", 1],
			["red", 2],
			["yellow", 2],
			["red", 3],
		]);
		expect(getConnectFourWinner(board)).toBe("red");
	});

	it("detects a vertical win", () => {
		const board = play([
			["yellow", 6],
			["red", 0],
			["yellow", 6],
			["red", 1],
			["yellow", 6],
			["red", 2],
			["yellow", 6],
		]);
		expect(getConnectFourWinner(board)).toBe("yellow");
	});

	it("detects a down-right diagonal win", () => {
		const board = play([
			["red", 0],
			["yellow", 1],
			["red", 1],
			["yellow", 2],
			["red", 2],
			["yellow", 3],
			["red", 2],
			["yellow", 3],
			["red", 3],
			["yellow", 0],
			["red", 3],
		]);
		expect(getConnectFourWinner(board)).toBe("red");
	});

	it("detects a down-left diagonal win", () => {
		const board = play([
			["red", 6],
			["yellow", 5],
			["red", 5],
			["yellow", 4],
			["red", 4],
			["yellow", 3],
			["red", 4],
			["yellow", 3],
			["red", 3],
			["yellow", 6],
			["red", 3],
		]);
		expect(getConnectFourWinner(board)).toBe("red");
	});

	it("detects a draw on a full board with no winner", () => {
		// Even columns stack RRYYRR bottom-up, odd columns YYRRYY:
		// rows alternate colors, columns cap at 2, diagonals at 2-3.
		let board = createConnectFourBoard();
		const evenStack: ConnectFourColor[] = [
			"red",
			"red",
			"yellow",
			"yellow",
			"red",
			"red",
		];
		for (let col = 0; col < CONNECT_FOUR_COLS; col += 1) {
			for (const color of evenStack) {
				board = applyConnectFourDrop(
					board,
					col % 2 === 0 ? color : color === "red" ? "yellow" : "red",
					col,
				).board;
			}
		}
		expect(board.every((cell) => cell !== "empty")).toBe(true);
		expect(getConnectFourWinner(board)).toBe("draw");
	});
});

describe("helpers", () => {
	it("switches colors", () => {
		expect(switchConnectFourColor("red")).toBe("yellow");
		expect(switchConnectFourColor("yellow")).toBe("red");
	});

	it("creates a 7x6 empty board", () => {
		const board = createConnectFourBoard();
		expect(board.length).toBe(42);
		expect(board.every((cell) => cell === "empty")).toBe(true);
	});
});
