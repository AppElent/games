import { generateBinaryPuzzle } from "@arcadeclub/core/binary-puzzle";
import { digitsToString } from "@arcadeclub/core/puzzle";
import {
	generatePuzzle,
	type SudokuDifficulty,
	type SudokuVariant,
} from "@arcadeclub/core/sudoku";
import { generateKillerPuzzle } from "@arcadeclub/core/sudoku-killer";
import type { FunctionArgs } from "convex/server";
import { rememberLocalSudokuSession } from "#/lib/games/sudoku-local";
import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type CreateArgs = FunctionArgs<typeof api.sudoku.create>;

/** A fresh puzzle of `variant` in the shape `sudoku.create` stores. */
export function generatedPuzzle(
	variant: SudokuVariant,
	difficulty: SudokuDifficulty,
) {
	if (variant === "binary") {
		const puzzle = generateBinaryPuzzle(difficulty);
		return {
			variant,
			size: puzzle.size,
			givens: digitsToString(puzzle.givens),
			solution: digitsToString(puzzle.solution),
		};
	}
	if (variant === "killer") {
		const puzzle = generateKillerPuzzle(difficulty);
		return {
			variant,
			cages: puzzle.cages,
			givens: digitsToString(puzzle.givens),
			solution: digitsToString(puzzle.solution),
		};
	}
	const puzzle = generatePuzzle(difficulty);
	return {
		givens: digitsToString(puzzle.givens),
		solution: digitsToString(puzzle.solution),
	};
}

/**
 * Stores a puzzle as a new session, then lists it on this device so it can be
 * resumed from the new-puzzle page. Generated and scanned puzzles both start
 * here.
 */
export async function createSudokuSession(
	create: (args: CreateArgs) => Promise<{
		sessionId: Id<"gameSessions">;
		participantId: Id<"sessionParticipants">;
	}>,
	args: CreateArgs,
) {
	const created = await create(args);
	rememberLocalSudokuSession({
		sessionId: created.sessionId,
		title: args.title,
		difficulty: args.difficulty,
		source: args.source,
		createdAt: Date.now(),
	});
	return created;
}
