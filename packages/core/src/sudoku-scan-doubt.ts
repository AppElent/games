/**
 * A read from the wrong rectangle of the photo is full of digits that each
 * look sure. The grid lines give it away; then every cell is flagged for the
 * player to check.
 */
import type { ScanCell } from "./sudoku-scan";
import type { GridMesh } from "./sudoku-scan-mesh";

/** Cells the four corners of a right grid move in all, one way, at most. */
const FARTHEST_MOVE = 3;
/** Below what the verifier flags. */
const DOUBTFUL = 0.5;

type Evidence = Pick<GridMesh, "found" | "moved">;

const isBoxLine = (line: number) => line % 3 === 0;

/**
 * The lines between the boxes are the ones a print draws thickest: where one
 * of them is missing, the grid is elsewhere. Where only the box lines are
 * found, both ways, a single box was taken for the grid. Thin lines go
 * missing in a blurred photo, and the outer ones off its edge. Corners that
 * have to move nearly a cell each are easily a whole row off.
 */
function looksWrong({ found, moved }: Evidence) {
	const ways = [found.vertical, found.horizontal];
	const missesBoxes = ways.some((lines) => !lines[3] || !lines[6]);
	const onlyBoxes = ways.every((lines) =>
		lines.every((line, i) => line === isBoxLine(i)),
	);
	return missesBoxes || onlyBoxes || moved >= FARTHEST_MOVE;
}

export function doubtWrongGrid(cells: ScanCell[], mesh: Evidence): ScanCell[] {
	if (!looksWrong(mesh)) return cells;
	return cells.map((cell) => ({
		...cell,
		confidence: Math.min(cell.confidence, DOUBTFUL),
	}));
}
