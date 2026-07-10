import { ConvexError, v } from "convex/values";
import {
	findBinaryConflicts,
	isBinarySolved,
} from "../src/lib/games/binary-puzzle";
import {
	findKillerConflicts,
	type KillerCage,
	validateKillerCages,
} from "../src/lib/games/sudoku-killer";
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

type SudokuVariant = "classic" | "killer" | "binary";

const BINARY_SIZES = [6, 8, 10, 12];

/** Cell count and digit alphabet for a state's variant. */
function gridSpec(variant: SudokuVariant, size?: number) {
	if (variant === "binary") {
		const side = size ?? 0;
		if (!BINARY_SIZES.includes(side)) {
			throw new ConvexError("Invalid binary board size");
		}
		return { cells: side * side, re: new RegExp(`^[0-2]{${side * side}}$`) };
	}
	return { cells: 81, re: /^[0-9]{81}$/ };
}

function assertGridString(
	value: string,
	label: string,
	spec: { re: RegExp },
) {
	if (!spec.re.test(value)) {
		throw new ConvexError(`Invalid ${label} grid`);
	}
}

function assertMaskArray(values: number[], label: string, cells: number) {
	if (
		values.length !== cells ||
		values.some((mask) => !Number.isInteger(mask) || mask < 0 || mask > 0x1ff)
	) {
		throw new ConvexError(`Invalid ${label}`);
	}
}

function gridToArray(grid: string) {
	return [...grid].map(Number);
}

/** Row/column/box duplicate check on an 81-char digit string. */
function hasConflicts(grid: string) {
	for (let unit = 0; unit < 27; unit += 1) {
		const seen = new Set<string>();
		for (let i = 0; i < 9; i += 1) {
			let cell: number;
			if (unit < 9) {
				cell = unit * 9 + i;
			} else if (unit < 18) {
				cell = i * 9 + (unit - 9);
			} else {
				const box = unit - 18;
				const row = Math.floor(box / 3) * 3 + Math.floor(i / 3);
				const col = (box % 3) * 3 + (i % 3);
				cell = row * 9 + col;
			}
			const value = grid[cell];
			if (value === "0") {
				continue;
			}
			if (seen.has(value)) {
				return true;
			}
			seen.add(value);
		}
	}
	return false;
}

function mergedGrid(givens: string, digits: string) {
	let merged = "";
	for (let cell = 0; cell < 81; cell += 1) {
		merged += givens[cell] !== "0" ? givens[cell] : digits[cell];
	}
	return merged;
}

function mergedGridAny(givens: string, digits: string) {
	let merged = "";
	for (let cell = 0; cell < givens.length; cell += 1) {
		merged += givens[cell] !== "0" ? givens[cell] : digits[cell];
	}
	return merged;
}

function isSolved(state: {
	variant?: SudokuVariant;
	givens: string;
	cages?: KillerCage[];
	size?: number;
	digits?: string;
}) {
	const variant = state.variant ?? "classic";
	const digits = state.digits ?? "";
	if (variant === "binary") {
		const merged = mergedGridAny(state.givens, digits);
		return isBinarySolved(gridToArray(merged), state.size ?? 0);
	}
	const merged = mergedGrid(state.givens, digits);
	if (merged.includes("0") || hasConflicts(merged)) {
		return false;
	}
	if (variant === "killer") {
		return (
			findKillerConflicts(gridToArray(merged), state.cages ?? []).size === 0
		);
	}
	return true;
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
		throw new ConvexError("Sudoku state not found");
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
			throw new ConvexError("Sudoku session not found");
		}
		const existing = await ctx.db
			.query("sudokuStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			throw new ConvexError("Sudoku state already exists");
		}
		const variant = args.variant ?? "classic";
		const spec = gridSpec(variant, args.size);
		assertGridString(args.givens, "givens", spec);
		const digits = args.digits ?? "0".repeat(spec.cells);
		assertGridString(digits, "digits", spec);
		if (args.solution) {
			assertGridString(args.solution, "solution", spec);
		}
		if (variant === "binary") {
			if (
				findBinaryConflicts(
					gridToArray(mergedGridAny(args.givens, digits)),
					args.size ?? 0,
				).size > 0
			) {
				throw new ConvexError("Puzzle contains conflicting digits");
			}
		} else {
			if (hasConflicts(mergedGrid(args.givens, digits))) {
				throw new ConvexError("Puzzle contains conflicting digits");
			}
		}
		if (variant === "killer") {
			if (!args.cages || !validateKillerCages(args.cages)) {
				throw new ConvexError("Invalid killer cages");
			}
			if (
				args.solution &&
				findKillerConflicts(gridToArray(args.solution), args.cages).size > 0
			) {
				throw new ConvexError("Solution does not satisfy the cages");
			}
		}
		const cornerNotes = args.cornerNotes ?? new Array(spec.cells).fill(0);
		const centerNotes = args.centerNotes ?? new Array(spec.cells).fill(0);
		assertMaskArray(cornerNotes, "corner notes", spec.cells);
		assertMaskArray(centerNotes, "center notes", spec.cells);

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
		assertGridString(args.digits, "digits", spec);
		assertMaskArray(args.cornerNotes, "corner notes", spec.cells);
		assertMaskArray(args.centerNotes, "center notes", spec.cells);
		assertMaskArray(args.colors, "colors", spec.cells);
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
			"digits",
			gridSpec(state.variant ?? "classic", state.size),
		);
		if (!isSolved({ ...state, digits: args.digits })) {
			throw new ConvexError("The grid is not solved yet");
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
			throw new ConvexError("Sudoku session not found");
		}
		const title = args.title.trim().slice(0, 80);
		if (!title) {
			throw new ConvexError("Title cannot be empty");
		}
		await ctx.db.patch(args.sessionId, { title });
	},
});
