import { useCallback, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { BinaryGame } from "./BinaryGame";
import { SudokuGame } from "./SudokuGame";
import type { PuzzleStateDoc } from "./useSoloPuzzleSession";

type SoloPuzzleProps = {
	sessionId: Id<"gameSessions">;
	title: string;
	/** The stored puzzle, kept live by the caller's subscription. */
	state: PuzzleStateDoc;
};

/**
 * The board for a stored puzzle. A board keeps its own state from when it
 * mounted; once the server refuses its save because another device saved a
 * newer one, it starts again from the stored puzzle. Convex settles a
 * mutation only after the subscriptions show its result, so `state` is the
 * newer board by then.
 */
export function SoloPuzzle({ sessionId, title, state }: SoloPuzzleProps) {
	const [reloads, setReloads] = useState(0);
	const reload = useCallback(() => setReloads((count) => count + 1), []);
	// Both boards take the same props; only binary draws its own grid.
	const Game = state.variant === "binary" ? BinaryGame : SudokuGame;
	return (
		<Game
			key={reloads}
			sessionId={sessionId}
			title={title}
			state={state}
			onStale={reload}
		/>
	);
}
