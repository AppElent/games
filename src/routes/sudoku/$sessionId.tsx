import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	pageShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
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
	return (
		<SessionBundleRoute
			bundle={bundle}
			shell={pageShell(messages.catalog.sudoku.title)}
			loading={messages.games.sudoku.session.loadingPuzzle}
			notFound={messages.games.sudoku.session.puzzleNotFound}
		>
			{(loaded) => {
				// Both boards take the same props; only binary draws its own grid.
				const Game =
					loaded.state.variant === "binary" ? BinaryGame : SudokuGame;
				return (
					<FullscreenGamePage
						title={loaded.session.title}
						maxWidthClassName="max-w-2xl"
					>
						<Game
							// Remount when switching sessions so local state resets.
							key={loaded.session._id}
							sessionId={loaded.session._id}
							title={loaded.session.title}
							state={loaded.state}
						/>
					</FullscreenGamePage>
				);
			}}
		</SessionBundleRoute>
	);
}
