import { act, fireEvent, screen } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import type { Id } from "../../../convex/api";
import { type CloudBundle, saveFromBundle } from "../saves/sudoku-cloud-sync";
import {
	deleteSudokuSave,
	listSudokuSaves,
	readSudokuSave,
	storeSyncedSave,
} from "../saves/sudoku-save-store";
import { SudokuPlayScreen } from "./sudoku-play-screen";

const ID = "stale";
const ME = "user_me";

/** The account's 6x6 binary puzzle with `digits` in its first cells. */
function accountSave(digits: string, updatedAt: number) {
	const bundle = {
		session: { _id: "session_1" as Id<"gameSessions">, title: "Binary" },
		state: {
			status: "active",
			variant: "binary",
			size: 6,
			givens: "0".repeat(36),
			digits: digits.padEnd(36, "0"),
			elapsedSeconds: 0,
			updatedAt,
			difficulty: "easy",
		},
	} as unknown as CloudBundle;
	return saveFromBundle(bundle, { id: ID, userId: ME, now: 0 });
}

const firstCells = () =>
	[1, 2].map(
		(column) =>
			screen.getByLabelText(new RegExp(`^Row 1, column ${column}(,|$)`)).props
				.accessibilityLabel as string,
	);

const storedEntries = () => {
	const save = readSudokuSave(ID);
	return save?.variant === "binary" ? save.entries.slice(0, 2) : undefined;
};

beforeEach(() => {
	for (const item of listSudokuSaves(ME)) deleteSudokuSave(item.id);
});

it("starts over from the account's newer board, leaving no trace of the stale one", async () => {
	storeSyncedSave(accountSave("", 1_000));
	const view = await renderScreen(<SudokuPlayScreen id={ID} />);
	await fireEvent.press(screen.getByLabelText(/^Row 1, column 1(,|$)/));
	expect(storedEntries()).toBe("10");
	const before = firstCells();

	await act(async () => storeSyncedSave(accountSave("02", 9_000)));
	expect(storedEntries()).toBe("02");
	expect(firstCells()).not.toEqual(before);

	// The next move builds on the newer board, and so does leaving the screen.
	await fireEvent.press(screen.getByLabelText(/^Row 1, column 1(,|$)/));
	expect(storedEntries()).toBe("12");
	await view.unmount();
	expect(storedEntries()).toBe("12");
	expect(readSudokuSave(ID)?.cloud?.baseUpdatedAt).toBe(9_000);
});
