import { digitsFromString } from "@arcadeclub/core/puzzle";
import { MAX_TITLE_LENGTH } from "@arcadeclub/core/sessions";
import { FULL_MASK, type SudokuVariant } from "@arcadeclub/core/sudoku";
import { effectiveGrid } from "@arcadeclub/core/sudoku-board";
import {
	isVariantGridString,
	SUDOKU_VARIANT_RULES,
	type VariantShape,
} from "@arcadeclub/core/sudoku-variants";
import { type ObjectType, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { gameError, rules } from "./lib/errors";
import {
	finishSession,
	isCaller,
	loadBundle,
	loadGame,
	loadSession,
	startSession,
} from "./lib/gameSession";
import {
	createdSession,
	createdSessionValidator,
	hostedSessionArgs,
	hostGame,
} from "./lib/hostedSession";
import {
	sudokuCageValidator,
	sudokuDifficultyValidator,
	sudokuSourceValidator,
	sudokuVariantValidator,
} from "./schema";

type Puzzle = VariantShape & { variant?: SudokuVariant };

/** The grid format a stored puzzle checks its strings against. */
function gridOf(puzzle: Puzzle) {
	const variant = puzzle.variant ?? "classic";
	const cells = rules(() => SUDOKU_VARIANT_RULES[variant].cells(puzzle));
	return {
		variant,
		cells,
		assert(value: string) {
			if (!isVariantGridString(variant, puzzle, value)) {
				throw gameError("invalidPuzzleData");
			}
		},
	};
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

/**
 * What every write to a puzzle takes: the session, and the guest id that
 * proves a guest's puzzle. A signed-in host's account is their proof.
 */
const puzzleWriteArgs = {
	sessionId: v.id("gameSessions"),
	guestId: v.optional(v.string()),
};

/**
 * Only a puzzle's host may change it: signed in as the host's account, or,
 * for a puzzle a guest started, holding that guest's id. Anyone else gets
 * `hostOnly`, whatever the puzzle's status.
 */
async function requirePuzzleHost(
	ctx: MutationCtx,
	session: Doc<"gameSessions">,
	guestId: string | undefined,
) {
	const host = session.hostParticipantId
		? await ctx.db.get(session.hostParticipantId)
		: null;
	if (!host) {
		throw gameError("hostOnly");
	}
	// LEGACY(APP-352): web tabs and cached PWA bundles from before APP-352 send
	// no guest id with these writes, so a guest's puzzle still takes a call
	// without one. A wrong guest id is refused, and so is anyone but the
	// account on an account's puzzle. Remove once those bundles are gone (APP-354).
	if (!host.userId && guestId === undefined) {
		return;
	}
	if (!(await isCaller(ctx, host, guestId))) {
		throw gameError("hostOnly");
	}
}

/** A puzzle has no lobby, so storing it starts its session. */
async function insertPuzzle(
	ctx: MutationCtx,
	session: Doc<"gameSessions">,
	puzzle: ObjectType<typeof puzzleArgs>,
) {
	const grid = gridOf(puzzle);
	const { variant, cells } = grid;
	grid.assert(puzzle.givens);
	const digits = puzzle.digits ?? "0".repeat(cells);
	grid.assert(digits);
	if (puzzle.solution) {
		grid.assert(puzzle.solution);
	}
	const variantRules = SUDOKU_VARIANT_RULES[variant];
	const merged = mergedGrid(puzzle.givens, digits);
	if (variantRules.conflicts(merged, puzzle).size > 0) {
		throw gameError("puzzleConflictingDigits");
	}
	const { solution } = puzzle;
	rules(() =>
		variantRules.validate(
			puzzle,
			solution ? digitsFromString(solution) : undefined,
		),
	);
	const cornerNotes = puzzle.cornerNotes ?? new Array(cells).fill(0);
	const centerNotes = puzzle.centerNotes ?? new Array(cells).fill(0);
	assertMaskArray(cornerNotes, cells);
	assertMaskArray(centerNotes, cells);

	const now = Date.now();
	const stateId = await ctx.db.insert("sudokuStates", {
		sessionId: session._id,
		difficulty: puzzle.difficulty,
		source: puzzle.source,
		status: "active",
		variant: puzzle.variant,
		...variantRules.stored(puzzle),
		givens: puzzle.givens,
		digits,
		solution: puzzle.solution,
		cornerNotes,
		centerNotes,
		colors: new Array(cells).fill(0),
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
		const hosted = await hostGame(ctx, "sudoku", args);
		await insertPuzzle(ctx, hosted.session, args);
		return createdSession(hosted);
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const bundle = await loadBundle(ctx, "sudoku", args.sessionId);
		if (!bundle?.state) {
			return null;
		}
		// Never ship the solution to the client.
		const { solution: _solution, ...safeState } = bundle.state;
		return { session: bundle.session, state: safeState };
	},
});

export const saveProgress = mutation({
	args: {
		...puzzleWriteArgs,
		digits: v.string(),
		cornerNotes: v.array(v.number()),
		centerNotes: v.array(v.number()),
		colors: v.array(v.number()),
		elapsedSeconds: v.number(),
		autoCleanup: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const { session, state } = await loadGame(ctx, "sudoku", args.sessionId);
		await requirePuzzleHost(ctx, session, args.guestId);
		if (state.status === "completed") {
			return;
		}
		const grid = gridOf(state);
		grid.assert(args.digits);
		assertMaskArray(args.cornerNotes, grid.cells);
		assertMaskArray(args.centerNotes, grid.cells);
		assertMaskArray(args.colors, grid.cells);
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
		...puzzleWriteArgs,
		paused: v.boolean(),
	},
	handler: async (ctx, args) => {
		const { session, state } = await loadGame(ctx, "sudoku", args.sessionId);
		await requirePuzzleHost(ctx, session, args.guestId);
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
		...puzzleWriteArgs,
		digits: v.string(),
		elapsedSeconds: v.number(),
	},
	handler: async (ctx, args) => {
		const { session, state } = await loadGame(ctx, "sudoku", args.sessionId);
		await requirePuzzleHost(ctx, session, args.guestId);
		if (state.status === "completed") {
			return { completed: true };
		}
		const grid = gridOf(state);
		grid.assert(args.digits);
		if (
			!SUDOKU_VARIANT_RULES[grid.variant].solved(
				mergedGrid(state.givens, args.digits),
				state,
			)
		) {
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
		...puzzleWriteArgs,
		title: v.string(),
	},
	handler: async (ctx, args) => {
		const session = await loadSession(
			ctx,
			"sudoku",
			args.sessionId,
			"sessionNotFound",
		);
		await requirePuzzleHost(ctx, session, args.guestId);
		const title = args.title.trim().slice(0, MAX_TITLE_LENGTH);
		if (!title) {
			throw gameError("titleEmpty");
		}
		await ctx.db.patch(args.sessionId, { title });
	},
});
