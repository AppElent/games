import { v } from "convex/values";
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
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { completeSession } from "./lib/completion";
import {
	sudokuCageValidator,
	sudokuDifficultyValidator,
	sudokuSourceValidator,
	sudokuVariantValidator,
} from "./schema";
import { gameError } from "./lib/errors";

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

async function getStateForSession(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
) {
	const state = await ctx.db
		.query("sudokuStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (!state) {
		throw gameError("gameNotFound");
	}
	return state;
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

export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
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
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "sudoku") {
			throw gameError("sessionNotFound");
		}
		const existing = await ctx.db
			.query("sudokuStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			throw gameError("gameAlreadyExists");
		}
		const variant = args.variant ?? "classic";
		const spec = gridSpec(variant, args.size);
		assertGridString(args.givens, spec);
		const digits = args.digits ?? "0".repeat(spec.cells);
		assertGridString(digits, spec);
		if (args.solution) {
			assertGridString(args.solution, spec);
		}
		const merged = mergedGrid(args.givens, digits);
		const conflicts =
			variant === "binary"
				? findBinaryConflicts(merged, args.size ?? 0)
				: findConflicts(merged);
		if (conflicts.size > 0) {
			throw gameError("puzzleConflictingDigits");
		}
		if (variant === "killer") {
			if (!args.cages || !validateKillerCages(args.cages)) {
				throw gameError("invalidKillerCages");
			}
			if (
				args.solution &&
				findKillerConflicts(digitsFromString(args.solution), args.cages).size > 0
			) {
				throw gameError("cagesUnsatisfied");
			}
		}
		const cornerNotes = args.cornerNotes ?? new Array(spec.cells).fill(0);
		const centerNotes = args.centerNotes ?? new Array(spec.cells).fill(0);
		assertMaskArray(cornerNotes, spec.cells);
		assertMaskArray(centerNotes, spec.cells);

		const now = Date.now();
		const stateId = await ctx.db.insert("sudokuStates", {
			sessionId: args.sessionId,
			difficulty: args.difficulty,
			source: args.source,
			status: "active",
			variant: args.variant,
			cages: variant === "killer" ? args.cages : undefined,
			size: variant === "binary" ? args.size : undefined,
			givens: args.givens,
			digits,
			solution: args.solution,
			cornerNotes,
			centerNotes,
			colors: new Array(spec.cells).fill(0),
			autoCleanup: args.autoCleanup ?? false,
			elapsedSeconds: 0,
			lastResumedAt: now,
			createdAt: now,
			updatedAt: now,
		});
		await ctx.db.patch(args.sessionId, {
			status: "active",
			startedAt: now,
		});
		return { stateId };
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const state = await ctx.db
			.query("sudokuStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
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
		const state = await getStateForSession(ctx, args.sessionId);
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
		const state = await getStateForSession(ctx, args.sessionId);
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
		const state = await getStateForSession(ctx, args.sessionId);
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
		await ctx.db.patch(state._id, {
			status: "completed",
			digits: args.digits,
			elapsedSeconds: args.elapsedSeconds,
			lastResumedAt: undefined,
			updatedAt: now,
		});
		await completeSession(ctx, args.sessionId, { endedAt: now });
		return { completed: true };
	},
});

export const rename = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "sudoku") {
			throw gameError("sessionNotFound");
		}
		const title = args.title.trim().slice(0, 80);
		if (!title) {
			throw gameError("titleEmpty");
		}
		await ctx.db.patch(args.sessionId, { title });
	},
});
