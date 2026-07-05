import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { SudokuGame } from "#/components/sudoku/SudokuGame";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/sudoku/$sessionId")({
	component: SudokuSessionPage,
	staticData: { fullscreen: true },
});

function SudokuSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.sudoku.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<FullscreenGamePage title="Sudoku">
				<p className="text-slate-300">Loading puzzle...</p>
			</FullscreenGamePage>
		);
	}
	if (bundle === null) {
		return (
			<FullscreenGamePage title="Sudoku">
				<p className="text-orange-200">Puzzle not found.</p>
			</FullscreenGamePage>
		);
	}

	return (
		<FullscreenGamePage
			title={bundle.session.title}
			maxWidthClassName="max-w-2xl"
		>
			<SudokuGame
				// Remount when switching sessions so local history resets.
				key={bundle.session._id}
				sessionId={bundle.session._id}
				title={bundle.session.title}
				state={bundle.state}
			/>
		</FullscreenGamePage>
	);
}
