import { createFileRoute } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	pageShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { BinaryGame } from "#/components/sudoku/BinaryGame";
import { SudokuGame } from "#/components/sudoku/SudokuGame";
import { useGuestId } from "#/lib/games/sessions";
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
	const guestId = useGuestId();
	const { isLoading: authLoading } = useConvexAuth();
	// Only the puzzle's host may read it: the guest id proves a guest's
	// puzzle, the account an account's. Asking before either is known would
	// show "not found" for a moment.
	const bundle = useQuery(
		api.sudoku.getBundle,
		guestId && !authLoading
			? { sessionId: sessionId as Id<"gameSessions">, guestId }
			: "skip",
	);
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
						// Wide enough on desktop for the board and the 360px
						// controls column side by side; narrower would squeeze
						// the keypad.
						maxWidthClassName="max-w-2xl lg:max-w-5xl"
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
