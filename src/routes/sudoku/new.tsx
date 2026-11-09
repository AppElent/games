import { createFileRoute } from "@tanstack/react-router";
import { SudokuNewPage } from "#/components/sudoku/SudokuNewPage";

export const Route = createFileRoute("/sudoku/new")({
	component: SudokuNewPage,
	staticData: { fullscreen: true },
});
