import { renderRouter } from "expo-router/testing-library";
import { Dimensions } from "react-native";
import { MemoryGameRepository } from "../src/storage/memory-game-repository";
import { SudokuGameService } from "../src/sudoku/game-service";

const givens = [
	5, 3, 0, 0, 7, 0, 0, 0, 0, 6, 0, 0, 1, 9, 5, 0, 0, 0, 0, 9, 8, 0, 0, 0, 0, 6,
	0, 8, 0, 0, 0, 6, 0, 0, 0, 3, 4, 0, 0, 8, 0, 3, 0, 0, 1, 7, 0, 0, 0, 2, 0, 0,
	0, 6, 0, 6, 0, 0, 0, 0, 2, 8, 0, 0, 0, 0, 4, 1, 9, 0, 0, 5, 0, 0, 0, 0, 8, 0,
	0, 7, 9,
];
const solution =
	"534678912672195348198342567859761423426853791713924856961537284287419635345286179";
let mockRepository: MemoryGameRepository;
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => "sudoku-game") }));
jest.mock("expo-sqlite", () => ({
	SQLiteProvider: ({ children }: { children: React.ReactNode }) => children,
	useSQLiteContext: jest.fn(() => ({})),
}));
jest.mock("../src/storage/sqlite-game-repository", () => ({
	SqliteGameRepository: jest.fn(() => mockRepository),
}));
beforeEach(() => {
	mockRepository = new MemoryGameRepository();
});

test.each([
	[320, 568],
	[390, 844],
	[430, 932],
])("keeps the board and controls within a %ix%i viewport", async (width, height) => {
	jest
		.spyOn(Dimensions, "get")
		.mockReturnValue({ fontScale: 1, height, scale: 1, width } as never);
	const service = new SudokuGameService(mockRepository, {
		generatePuzzle: () => ({
			clueCount: givens.filter(Boolean).length,
			difficulty: "easy",
			givens,
			solution: solution.split("").map(Number),
		}),
	});
	const game = await service.createGame("easy", 1000);
	const screen = await renderRouter("src/app", {
		initialUrl: `/sudoku/${game.id}`,
	});
	const board = await screen.findByTestId("sudoku-board");
	expect(board.props.style[1]).toEqual({
		height: Math.min(width - 24, 560),
		width: Math.min(width - 24, 560),
	});
	expect(screen.getByRole("button", { name: "Enter 9" })).toBeVisible();
	expect(screen.getByRole("switch", { name: "Notes" })).toBeVisible();
});
