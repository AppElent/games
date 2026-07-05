import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sudoku/")({
	beforeLoad: () => {
		throw redirect({ to: "/sudoku/new" });
	},
});
