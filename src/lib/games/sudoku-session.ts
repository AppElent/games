import { digitsToString } from "@arcadeclub/core/puzzle";
import type { SudokuDifficulty, SudokuVariant } from "@arcadeclub/core/sudoku";
import {
	generateVariantPuzzle,
	SUDOKU_VARIANT_RULES,
} from "@arcadeclub/core/sudoku-variants";
import type { FunctionArgs } from "convex/server";
import { rememberLocalSudokuSession } from "#/lib/games/sudoku-local";
import type { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type CreateArgs = FunctionArgs<typeof api.sudoku.create>;

/**
 * A fresh puzzle of `variant` in the shape `sudoku.create` stores. Classic
 * puzzles carry no `variant`, like every classic session stored before
 * variants existed.
 */
export function generatedPuzzle(
	variant: SudokuVariant,
	difficulty: SudokuDifficulty,
) {
	const puzzle = generateVariantPuzzle(variant, difficulty);
	return {
		...(variant === "classic" ? {} : { variant }),
		...SUDOKU_VARIANT_RULES[variant].stored(puzzle),
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
