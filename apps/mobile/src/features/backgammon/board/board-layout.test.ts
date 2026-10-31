import { boardGeometry, boardRows } from "./board-layout";

describe("board layout", () => {
	it("puts the viewer's home board bottom right", () => {
		expect(boardRows("white").bottom.slice(-6)).toEqual([6, 5, 4, 3, 2, 1]);
		expect(boardRows("black").bottom.slice(-6)).toEqual([
			19, 20, 21, 22, 23, 24,
		]);
	});

	it("covers every point exactly once", () => {
		for (const viewer of ["white", "black"] as const) {
			const { top, bottom } = boardRows(viewer);
			expect([...top, ...bottom].sort((a, b) => a - b)).toEqual(
				Array.from({ length: 24 }, (_, index) => index + 1),
			);
		}
	});

	it("fits the columns, bar and tray inside the frame", () => {
		const geometry = boardGeometry(360);
		const inner = 360 - geometry.frame * 2;
		expect(geometry.trayX + geometry.trayWidth).toBeCloseTo(inner);
		expect(geometry.columnX(6)).toBeCloseTo(geometry.barX + geometry.barWidth);
	});
});
