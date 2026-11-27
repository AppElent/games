import {
	boardGeometry,
	boardRows,
	fitBoardWidth,
	hitGrid,
	hitTestBoard,
	slotCenter,
} from "./board-layout";

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

describe("hit test", () => {
	const geometry = boardGeometry(360);
	const { frame, unit, half, gap, height, width } = geometry;
	const white = hitGrid(geometry, "white");
	const black = hitGrid(geometry, "black");
	const columnMiddle = (column: number) =>
		frame + geometry.columnX(column) + unit / 2;

	it("finds the point anywhere in its half-column", () => {
		// Left edge of the top row is point 13 for White, 12 for Black.
		expect(hitTestBoard(white, columnMiddle(0), frame + 1)).toBe(13);
		expect(hitTestBoard(white, columnMiddle(0), frame + half - 1)).toBe(13);
		expect(hitTestBoard(black, columnMiddle(0), frame + 1)).toBe(12);
		// Bottom right is the viewer's ace point.
		expect(hitTestBoard(white, columnMiddle(11), frame + half + gap + 1)).toBe(
			1,
		);
		expect(hitTestBoard(black, columnMiddle(11), height - frame - 1)).toBe(24);
		// Right of the bar, the columns carry on.
		expect(hitTestBoard(white, columnMiddle(6), frame + 1)).toBe(19);
	});

	it("finds the bar and the tray over their full height", () => {
		const barMiddle = frame + geometry.barX + geometry.barWidth / 2;
		const trayMiddle = frame + geometry.trayX + geometry.trayWidth / 2;
		expect(hitTestBoard(white, barMiddle, frame + 1)).toBe("bar");
		expect(hitTestBoard(white, barMiddle, frame + half + gap / 2)).toBe("bar");
		expect(hitTestBoard(white, trayMiddle, height - frame - 1)).toBe("off");
	});

	it("finds nothing on the frame, the middle band or outside", () => {
		expect(hitTestBoard(white, frame / 2, frame + 10)).toBeNull();
		expect(hitTestBoard(white, columnMiddle(3), frame / 2)).toBeNull();
		expect(
			hitTestBoard(white, columnMiddle(3), frame + half + gap / 2),
		).toBeNull();
		expect(hitTestBoard(white, columnMiddle(3), -40)).toBeNull();
		expect(hitTestBoard(white, width + 10, frame + 10)).toBeNull();
		expect(hitTestBoard(white, columnMiddle(3), height + 10)).toBeNull();
	});
});

describe("slot centres", () => {
	const geometry = boardGeometry(360);

	it("lands back where the hit test finds the same place", () => {
		const grid = hitGrid(geometry, "white");
		for (const point of [1, 6, 7, 12, 13, 18, 19, 24]) {
			for (const index of [0, 2, 4, 9]) {
				const { x, y } = slotCenter(geometry, "white", {
					kind: "point",
					point,
					index,
				});
				expect(hitTestBoard(grid, x, y)).toBe(point);
			}
		}
		for (const side of ["viewer", "opponent"] as const) {
			const { x, y } = slotCenter(geometry, "white", {
				kind: "bar",
				side,
				index: 1,
			});
			expect(hitTestBoard(grid, x, y)).toBe("bar");
		}
		for (const side of ["viewer", "opponent"] as const) {
			const off = slotCenter(geometry, "white", {
				kind: "off",
				side,
				index: 14,
			});
			expect(hitTestBoard(grid, off.x, off.y)).toBe("off");
		}
		const viewerOff = slotCenter(geometry, "white", {
			kind: "off",
			side: "viewer",
			index: 0,
		});
		expect(viewerOff.y).toBeGreaterThan(geometry.height / 2);
	});

	it("stacks from the rim inward and stops at the fifth checker", () => {
		const at = (index: number) =>
			slotCenter(geometry, "white", { kind: "point", point: 24, index });
		expect(at(1).y).toBeCloseTo(at(0).y + geometry.checker);
		expect(at(9)).toEqual(at(4));
		const bottom = (index: number) =>
			slotCenter(geometry, "white", { kind: "point", point: 1, index });
		expect(bottom(1).y).toBeCloseTo(bottom(0).y - geometry.checker);
	});
});
