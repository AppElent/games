const GRID_SIZE = 9;

/** Where an arrow key (or Home/End) moves focus in the 9x9 grid, clamped at the edges. */
export function nextGridIndex(index: number, key: string): number | null {
	const row = Math.floor(index / GRID_SIZE);
	const col = index % GRID_SIZE;
	switch (key) {
		case "ArrowLeft":
			return row * GRID_SIZE + Math.max(0, col - 1);
		case "ArrowRight":
			return row * GRID_SIZE + Math.min(GRID_SIZE - 1, col + 1);
		case "ArrowUp":
			return Math.max(0, row - 1) * GRID_SIZE + col;
		case "ArrowDown":
			return Math.min(GRID_SIZE - 1, row + 1) * GRID_SIZE + col;
		case "Home":
			return row * GRID_SIZE;
		case "End":
			return row * GRID_SIZE + GRID_SIZE - 1;
		default:
			return null;
	}
}
