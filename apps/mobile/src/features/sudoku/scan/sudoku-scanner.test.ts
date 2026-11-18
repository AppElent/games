import { sudokuScanner } from "../../../../modules/sudoku-scanner";

describe("sudokuScanner", () => {
	it("is null where the native module is missing, so the scan entry hides", () => {
		// Jest has no native modules, like Android or an iOS build from before
		// the scanner shipped that runs this JavaScript as an update.
		expect(sudokuScanner).toBeNull();
	});
});
