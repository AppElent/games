import { fireEvent, renderRouter } from "expo-router/testing-library";
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
jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(),
	notificationAsync: jest.fn(),
	ImpactFeedbackStyle: { Light: "light" },
	NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));
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
function createService() {
	return new SudokuGameService(mockRepository, {
		generatePuzzle: () => ({
			clueCount: givens.filter(Boolean).length,
			difficulty: "easy",
			givens,
			solution: solution.split("").map(Number),
		}),
	});
}
async function renderGame() {
	const game = await createService().createGame("easy", 1000);
	const screen = await renderRouter("src/app", {
		initialUrl: `/sudoku/${game.id}`,
	});
	await screen.findByRole("header", { name: "Sudoku" });
	return { game, screen };
}

test("enters digits and notes into selected empty cells", async () => {
	const { screen } = await renderGame();
	fireEvent.press(screen.getByLabelText(/^Row 1 column 3, empty/));
	await screen.findByLabelText(/^Row 1 column 3, empty.*selected/);
	fireEvent.press(screen.getByRole("button", { name: "Enter 4" }));
	expect(await screen.findByLabelText(/^Row 1 column 3, 4/)).toBeVisible();
	expect(screen.getByLabelText("Notes")).toBeVisible();
	screen.unmount();
});
