import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { BinaryGame } from "#/components/sudoku/BinaryGame";
import { SudokuGame } from "#/components/sudoku/SudokuGame";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/sudoku/$sessionId")({
	component: SudokuSessionPage,
	staticData: { fullscreen: true },
});

function SudokuSessionPage() {
	const messages = useMessages();
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.sudoku.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<FullscreenGamePage title={messages.catalog.sudoku.title}>
				<p className="text-slate-300">
					{messages.games.sudoku.session.loadingPuzzle}
				</p>
			</FullscreenGamePage>
		);
	}
	if (bundle === null) {
		return (
			<FullscreenGamePage title={messages.catalog.sudoku.title}>
				<p className="text-orange-200">
					{messages.games.sudoku.session.puzzleNotFound}
				</p>
			</FullscreenGamePage>
		);
	}

	return (
		<FullscreenGamePage
			title={bundle.session.title}
			maxWidthClassName="max-w-2xl"
		>
			{bundle.state.variant === "binary" ? (
				<BinaryGame
					// Remount when switching sessions so local state resets.
					key={bundle.session._id}
					sessionId={bundle.session._id}
					title={bundle.session.title}
					state={bundle.state}
				/>
			) : (
				<SudokuGame
					// Remount when switching sessions so local history resets.
					key={bundle.session._id}
					sessionId={bundle.session._id}
					title={bundle.session.title}
					state={bundle.state}
				/>
			)}
		</FullscreenGamePage>
	);
}
