import { type ObjectType, v } from "convex/values";
import {
	BINARY_ACCEPTED_SIZES,
	findBinaryConflicts,
	isBinarySolved,
} from "@arcadeclub/core/binary-puzzle";
import { digitsFromString } from "@arcadeclub/core/puzzle";
import {
	FULL_MASK,
	findConflicts,
	isGridSolved,
	SUDOKU_CELL_COUNT,
	type SudokuVariant,
} from "@arcadeclub/core/sudoku";
import { effectiveGrid } from "@arcadeclub/core/sudoku-board";
import {
	findKillerConflicts,
	isKillerSolved,
	type KillerCage,
	validateKillerCages,
} from "@arcadeclub/core/sudoku-killer";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	sudokuCageValidator,
	sudokuDifficultyValidator,
	sudokuSourceValidator,
	sudokuVariantValidator,
} from "./schema";
import { gameError } from "./lib/errors";
import {
	findGameState,
	finishSession,
	loadGame,
	loadSession,
	startSession,
} from "./lib/gameSession";
import {
	createdSessionValidator,
	createHostedSession,
	hostedSessionArgs,
} from "./lib/hostedSession";

/** Cell count and digit alphabet for a state's variant. */
function gridSpec(variant: SudokuVariant, size?: number) {
	if (variant === "binary") {
		const side = size ?? 0;
		if (!BINARY_ACCEPTED_SIZES.includes(side)) {
			throw gameError("invalidBinarySize");
		}
		return { cells: side * side, re: new RegExp(`^[0-2]{${side * side}}$`) };
	}
	return {
		cells: SUDOKU_CELL_COUNT,
		re: new RegExp(`^[0-9]{${SUDOKU_CELL_COUNT}}$`),
	};
}

function assertGridString(
	value: string,
	spec: { re: RegExp },
) {
	if (!spec.re.test(value)) {
		throw gameError("invalidPuzzleData");
	}
}

function assertMaskArray(values: number[], cells: number) {
	if (
		values.length !== cells ||
		values.some(
			(mask) => !Number.isInteger(mask) || mask < 0 || mask > FULL_MASK,
		)
	) {
		throw gameError("invalidPuzzleData");
	}
}

function mergedGrid(givens: string, digits: string) {
	return effectiveGrid({
		givens: digitsFromString(givens),
		digits: digitsFromString(digits),
	});
}

function isSolved(state: {
	variant?: SudokuVariant;
	givens: string;
	cages?: KillerCage[];
	size?: number;
	digits: string;
}) {
	const merged = mergedGrid(state.givens, state.digits);
	switch (state.variant ?? "classic") {
		case "binary":
			return isBinarySolved(merged, state.size ?? 0);
		case "killer":
			return isKillerSolved(merged, state.cages ?? []);
		case "classic":
			return isGridSolved(merged);
	}
}

function foldElapsed(state: {
	elapsedSeconds: number;
	lastResumedAt?: number;
}) {
	if (!state.lastResumedAt) {
		return state.elapsedSeconds;
	}
	return (
		state.elapsedSeconds +
		Math.max(0, Math.round((Date.now() - state.lastResumedAt) / 1000))
	);
}

const puzzleArgs = {
	source: sudokuSourceValidator,
	difficulty: v.optional(sudokuDifficultyValidator),
	variant: v.optional(sudokuVariantValidator),
	cages: v.optional(v.array(sudokuCageValidator)),
	size: v.optional(v.number()),
	givens: v.string(),
	digits: v.optional(v.string()),
	solution: v.optional(v.string()),
	cornerNotes: v.optional(v.array(v.number())),
	centerNotes: v.optional(v.array(v.number())),
	autoCleanup: v.optional(v.boolean()),
};

/** A puzzle has no lobby, so storing it starts its session. */
async function insertPuzzle(
	ctx: MutationCtx,
	session: Doc<"gameSessions">,
	puzzle: ObjectType<typeof puzzleArgs>,
) {
	const variant = puzzle.variant ?? "classic";
	const spec = gridSpec(variant, puzzle.size);
	assertGridString(puzzle.givens, spec);
	const digits = puzzle.digits ?? "0".repeat(spec.cells);
	assertGridString(digits, spec);
	if (puzzle.solution) {
		assertGridString(puzzle.solution, spec);
	}
	const merged = mergedGrid(puzzle.givens, digits);
	const conflicts =
		variant === "binary"
			? findBinaryConflicts(merged, puzzle.size ?? 0)
			: findConflicts(merged);
	if (conflicts.size > 0) {
		throw gameError("puzzleConflictingDigits");
	}
	if (variant === "killer") {
		if (!puzzle.cages || !validateKillerCages(puzzle.cages)) {
			throw gameError("invalidKillerCages");
		}
		if (
			puzzle.solution &&
			findKillerConflicts(digitsFromString(puzzle.solution), puzzle.cages)
				.size > 0
		) {
			throw gameError("cagesUnsatisfied");
		}
	}
	const cornerNotes = puzzle.cornerNotes ?? new Array(spec.cells).fill(0);
	const centerNotes = puzzle.centerNotes ?? new Array(spec.cells).fill(0);
	assertMaskArray(cornerNotes, spec.cells);
	assertMaskArray(centerNotes, spec.cells);

	const now = Date.now();
	const stateId = await ctx.db.insert("sudokuStates", {
		sessionId: session._id,
		difficulty: puzzle.difficulty,
		source: puzzle.source,
		status: "active",
		variant: puzzle.variant,
		cages: variant === "killer" ? puzzle.cages : undefined,
		size: variant === "binary" ? puzzle.size : undefined,
		givens: puzzle.givens,
		digits,
		solution: puzzle.solution,
		cornerNotes,
		centerNotes,
		colors: new Array(spec.cells).fill(0),
		autoCleanup: puzzle.autoCleanup ?? false,
		elapsedSeconds: 0,
		lastResumedAt: now,
		createdAt: now,
		updatedAt: now,
	});
	await startSession(ctx, session, now);
	return stateId;
}

export const create = mutation({
	args: { ...hostedSessionArgs, ...puzzleArgs },
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		const hosted = await createHostedSession(ctx, {
			...args,
			gameType: "sudoku",
			joinMode: "solo",
			authPolicy: "guestAllowed",
		});
		await insertPuzzle(
			ctx,
			await loadSession(ctx, "sudoku", hosted.sessionId),
			args,
		);
		return hosted;
	},
});

/** @deprecated Use sudoku.create. */
export const createState = mutation({
	args: { sessionId: v.id("gameSessions"), ...puzzleArgs },
	handler: async (ctx, args) => {
		const session = await loadSession(
			ctx,
			"sudoku",
			args.sessionId,
			"sessionNotFound",
		);
		const existing = await findGameState(ctx, "sudoku", args.sessionId);
		if (existing) {
			throw gameError("gameAlreadyExists");
		}
		return { stateId: await insertPuzzle(ctx, session, args) };
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const state = await findGameState(ctx, "sudoku", args.sessionId);
		if (!state) {
			return null;
		}
		// Never ship the solution to the client.
		const { solution: _solution, ...safeState } = state;
		return { session, state: safeState };
	},
});

export const saveProgress = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		digits: v.string(),
		cornerNotes: v.array(v.number()),
		centerNotes: v.array(v.number()),
		colors: v.array(v.number()),
		elapsedSeconds: v.number(),
		autoCleanup: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "sudoku", args.sessionId);
		if (state.status === "completed") {
			return;
		}
		const spec = gridSpec(state.variant ?? "classic", state.size);
		assertGridString(args.digits, spec);
		assertMaskArray(args.cornerNotes, spec.cells);
		assertMaskArray(args.centerNotes, spec.cells);
		assertMaskArray(args.colors, spec.cells);
		await ctx.db.patch(state._id, {
			digits: args.digits,
			cornerNotes: args.cornerNotes,
			centerNotes: args.centerNotes,
			colors: args.colors,
			elapsedSeconds: args.elapsedSeconds,
			lastResumedAt: state.status === "active" ? Date.now() : undefined,
			autoCleanup: args.autoCleanup ?? state.autoCleanup,
			updatedAt: Date.now(),
		});
	},
});

export const setPaused = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		paused: v.boolean(),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "sudoku", args.sessionId);
		if (state.status === "completed") {
			return;
		}
		if (args.paused) {
			await ctx.db.patch(state._id, {
				status: "paused",
				elapsedSeconds: foldElapsed(state),
				lastResumedAt: undefined,
				updatedAt: Date.now(),
			});
		} else {
			await ctx.db.patch(state._id, {
				status: "active",
				lastResumedAt: Date.now(),
				updatedAt: Date.now(),
			});
		}
	},
});

export const complete = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		digits: v.string(),
		elapsedSeconds: v.number(),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "sudoku", args.sessionId);
		if (state.status === "completed") {
			return { completed: true };
		}
		assertGridString(
			args.digits,
			gridSpec(state.variant ?? "classic", state.size),
		);
		if (!isSolved({ ...state, digits: args.digits })) {
			throw gameError("gridNotSolved");
		}
		const now = Date.now();
		await finishSession(
			ctx,
			state,
			{
				status: "completed",
				digits: args.digits,
				elapsedSeconds: args.elapsedSeconds,
				lastResumedAt: undefined,
				updatedAt: now,
			},
			{ now, winners: [] },
		);
		return { completed: true };
	},
});

export const rename = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		await loadSession(ctx, "sudoku", args.sessionId, "sessionNotFound");
		const title = args.title.trim().slice(0, 80);
		if (!title) {
			throw gameError("titleEmpty");
		}
		await ctx.db.patch(args.sessionId, { title });
	},
});
