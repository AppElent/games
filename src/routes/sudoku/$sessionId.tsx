import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { SudokuGame } from "#/components/sudoku/SudokuGame";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/sudoku/$sessionId")({
	component: SudokuSessionPage,
});

function SudokuSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.sudoku.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<main className="club-wrap py-10 text-slate-300">Loading puzzle...</main>
		);
	}
	if (bundle === null) {
		return (
			<main className="club-wrap py-10 text-orange-200">Puzzle not found.</main>
		);
	}

	return (
		<main className="club-wrap py-6">
			<SudokuGame
				// Remount when switching sessions so local history resets.
				key={bundle.session._id}
				sessionId={bundle.session._id}
				title={bundle.session.title}
				state={bundle.state}
			/>
		</main>
	);
}
