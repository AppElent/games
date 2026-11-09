import { boardGeometry, boardRows, fitBoardWidth } from "./board-layout";

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

	it("follows the system text scale and grows the label band to fit", () => {
		const normal = boardGeometry(360, 1);
		const large = boardGeometry(360, 1.6);
		expect(large.text.label).toBeGreaterThan(normal.text.label);
		expect(large.gap).toBeGreaterThanOrEqual(large.text.labelLine * 2);
		expect(large.height).toBeGreaterThan(normal.height);
	});

	it("stops growing board text once it fills a column or checker", () => {
		const { unit, text } = boardGeometry(360, 3.5);
		expect(text.label).toBeLessThanOrEqual(unit * 0.78);
		expect(text.count).toBeLessThanOrEqual(unit * 0.5);
	});

	it("fits the widest board into a height", () => {
		const width = fitBoardWidth(1000, 350, 1);
		expect(boardGeometry(width).height).toBeLessThanOrEqual(350);
		expect(boardGeometry(width + 1).height).toBeGreaterThan(350);
		expect(fitBoardWidth(300, 1000)).toBe(300);
	});
});
