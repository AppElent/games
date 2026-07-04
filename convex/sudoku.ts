import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { sudokuDifficultyValidator, sudokuSourceValidator } from "./schema";

const GRID_RE = /^[0-9]{81}$/;

function assertGridString(value: string, label: string) {
	if (!GRID_RE.test(value)) {
		throw new ConvexError(`Invalid ${label} grid`);
	}
}

function assertMaskArray(values: number[], label: string) {
	if (
		values.length !== 81 ||
		values.some((mask) => !Number.isInteger(mask) || mask < 0 || mask > 0x1ff)
	) {
		throw new ConvexError(`Invalid ${label}`);
	}
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

function isSolved(givens: string, digits: string) {
	const merged = mergedGrid(givens, digits);
	return !merged.includes("0") && !hasConflicts(merged);
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
		assertGridString(args.givens, "givens");
		const digits = args.digits ?? "0".repeat(81);
		assertGridString(digits, "digits");
		if (args.solution) {
			assertGridString(args.solution, "solution");
		}
		if (hasConflicts(mergedGrid(args.givens, digits))) {
			throw new ConvexError("Puzzle contains conflicting digits");
		}
		const cornerNotes = args.cornerNotes ?? new Array(81).fill(0);
		const centerNotes = args.centerNotes ?? new Array(81).fill(0);
		assertMaskArray(cornerNotes, "corner notes");
		assertMaskArray(centerNotes, "center notes");

		const now = Date.now();
		const stateId = await ctx.db.insert("sudokuStates", {
			sessionId: args.sessionId,
			difficulty: args.difficulty,
			source: args.source,
			status: "active",
			givens: args.givens,
			digits,
			solution: args.solution,
			cornerNotes,
			centerNotes,
			colors: new Array(81).fill(0),
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
		assertGridString(args.digits, "digits");
		assertMaskArray(args.cornerNotes, "corner notes");
		assertMaskArray(args.centerNotes, "center notes");
		assertMaskArray(args.colors, "colors");
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
		assertGridString(args.digits, "digits");
		if (!isSolved(state.givens, args.digits)) {
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
		await ctx.db.patch(args.sessionId, {
			status: "completed",
			endedAt: now,
		});
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
