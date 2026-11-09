import { digitsToString } from "@arcadeclub/core/puzzle";
import { generateVariantPuzzle } from "@arcadeclub/core/sudoku-variants";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	advance,
	deletedSessionId,
	expectCode,
	fields,
	getDoc,
	otherGameSession,
	sessionCount,
	type SessionId,
	setup,
	type T,
	T0,
	useFixedClock,
} from "./test.helpers";

useFixedClock();

const SOLVED =
	"534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const EMPTY = "0".repeat(81);
/** The solved grid with its first row blanked. */
const GIVENS = EMPTY.slice(0, 9) + SOLVED.slice(9);
const ZEROES = () => new Array(81).fill(0);
/** The same valid grid with its 5s and 6s swapped, which breaks a sum cage. */
const SOLVED_RELABELLED = SOLVED.replace(/[56]/g, (d) =>
	d === "5" ? "6" : "5",
);

const BINARY_SOLVED = "112122112212221121121122212211221211";
const BINARY_EMPTY = "0".repeat(36);

/** Row cages, except that row one splits into `5+3` and the rest of the row. */
const CAGES = [
	{ sum: 8, cells: [0, 1] },
	{ sum: 37, cells: [2, 3, 4, 5, 6, 7, 8] },
	...Array.from({ length: 8 }, (_, row) => ({
		sum: 45,
		cells: Array.from({ length: 9 }, (__, col) => (row + 1) * 9 + col),
	})),
];

/** A solo session with no puzzle yet, which `create` never leaves behind. */
async function soloSession(t: T) {
	return await t.mutation(api.sessions.create, {
		gameType: "sudoku",
		joinMode: "solo",
		authPolicy: "guestAllowed",
		title: "Puzzle",
		displayName: "Solver",
		guestId: "guest_solver",
	});
}

/** Sudoku is solo, so a guest hosts it. */
function createPuzzle(
	t: T,
	overrides: {
		variant?: "classic" | "killer" | "binary";
		cages?: { sum: number; cells: number[] }[];
		size?: number;
		givens?: string;
		digits?: string;
		solution?: string;
		cornerNotes?: number[];
		centerNotes?: number[];
		autoCleanup?: boolean;
	} = {},
) {
	return t.mutation(api.sudoku.create, {
		title: "Puzzle",
		displayName: "Solver",
		guestId: "guest_solver",
		source: "generated",
		difficulty: "easy",
		givens: GIVENS,
		solution: SOLVED,
		...overrides,
	});
}

function killerPuzzle(t: T) {
	return createPuzzle(t, {
		variant: "killer",
		cages: CAGES,
		givens: EMPTY,
		solution: SOLVED,
	});
}

function binaryPuzzle(t: T, size = 6) {
	return createPuzzle(t, {
		variant: "binary",
		size,
		givens: "0".repeat(size * size),
		solution: undefined,
	});
}

function progress(sessionId: SessionId, overrides: object = {}) {
	return {
		sessionId,
		digits: EMPTY,
		cornerNotes: ZEROES(),
		centerNotes: ZEROES(),
		colors: ZEROES(),
		elapsedSeconds: 42,
		...overrides,
	};
}

function complete(
	t: T,
	sessionId: SessionId,
	digits = SOLVED,
	elapsedSeconds = 99,
) {
	return t.mutation(api.sudoku.complete, { sessionId, digits, elapsedSeconds });
}

async function storedState(t: T, sessionId: SessionId) {
	return (await t.run((ctx) =>
		ctx.db
			.query("sudokuStates")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.unique(),
	)) as Doc<"sudokuStates">;
}

async function bundle(t: T, sessionId: SessionId) {
	const result = await t.query(api.sudoku.getBundle, { sessionId });
	if (!result) {
		throw new Error("Expected a sudoku bundle");
	}
	return result;
}

describe("new puzzle", () => {
	it("stores a classic puzzle and starts the session at once", async () => {
		const t = setup();
		const { sessionId, participantId } = await createPuzzle(t);
		const stored = await storedState(t, sessionId);
		expect(fields(stored)).toEqual({
			sessionId,
			difficulty: "easy",
			source: "generated",
			status: "active",
			givens: GIVENS,
			digits: EMPTY,
			solution: SOLVED,
			cornerNotes: ZEROES(),
			centerNotes: ZEROES(),
			colors: ZEROES(),
			autoCleanup: false,
			elapsedSeconds: 0,
			lastResumedAt: T0,
			createdAt: T0,
			updatedAt: T0,
		});
		const { session } = await bundle(t, sessionId);
		expect(fields(session)).toEqual({
			gameType: "sudoku",
			status: "active",
			joinMode: "solo",
			authPolicy: "guestAllowed",
			title: "Puzzle",
			hostParticipantId: participantId,
			startedAt: T0,
		});
	});

	it("accepts digits, notes, and auto-cleanup from a scan flow", async () => {
		const t = setup();
		const notes = ZEROES();
		notes[0] = 0x1ff;
		const digits = `5${EMPTY.slice(1)}`;
		const { sessionId } = await createPuzzle(t, {
			givens: EMPTY,
			digits,
			solution: undefined,
			cornerNotes: notes,
			centerNotes: notes,
			autoCleanup: true,
		});
		const stored = await storedState(t, sessionId);
		expect(stored.digits).toBe(digits);
		expect(stored.cornerNotes[0]).toBe(0x1ff);
		expect(stored.centerNotes[0]).toBe(0x1ff);
		expect(stored.autoCleanup).toBe(true);
		expect(stored.solution).toBeUndefined();
	});

	it("keeps the cages only on a killer puzzle", async () => {
		const t = setup();
		const killer = await killerPuzzle(t);
		const stored = await storedState(t, killer.sessionId);
		expect(stored.variant).toBe("killer");
		expect(stored.cages).toEqual(CAGES);
		const classic = await createPuzzle(t, { cages: CAGES });
		expect((await storedState(t, classic.sessionId)).cages).toBeUndefined();
	});

	it("keeps the size only on a binary puzzle and sizes notes to the grid", async () => {
		const t = setup();
		const binary = await binaryPuzzle(t);
		const stored = await storedState(t, binary.sessionId);
		expect(stored.variant).toBe("binary");
		expect(stored.size).toBe(6);
		expect(stored.digits).toBe(BINARY_EMPTY);
		expect(stored.cornerNotes).toHaveLength(36);
		expect(stored.colors).toHaveLength(36);
		const classic = await createPuzzle(t, { size: 6 });
		expect((await storedState(t, classic.sessionId)).size).toBeUndefined();
	});

	it("accepts a binary size 12, which no generator makes", async () => {
		const t = setup();
		const { sessionId } = await binaryPuzzle(t, 12);
		expect((await storedState(t, sessionId)).size).toBe(12);
	});

	it("answers invalidPuzzleData for bad grids and note masks", async () => {
		const t = setup();
		for (const overrides of [
			{ givens: "123" },
			{ givens: `x${GIVENS.slice(1)}` },
			{ digits: "123" },
			{ solution: "123" },
			{ cornerNotes: [0] },
			{ centerNotes: [0] },
			{ cornerNotes: [512, ...ZEROES().slice(1)] },
			{ cornerNotes: [-1, ...ZEROES().slice(1)] },
			{ centerNotes: [0.5, ...ZEROES().slice(1)] },
		]) {
			await expectCode(
				createPuzzle(t, overrides),
				"invalidPuzzleData",
			);
		}
		await expectCode(
			createPuzzle(t, {
					variant: "binary",
					size: 6,
					givens: `3${BINARY_EMPTY.slice(1)}`,
					solution: undefined,
				}),
			"invalidPuzzleData",
		);
	});

	it("answers puzzleConflictingDigits for a clash in givens or digits", async () => {
		const t = setup();
		for (const overrides of [
			{ givens: `55${EMPTY.slice(2)}` },
			{ givens: `5${EMPTY.slice(1)}`, digits: `05${EMPTY.slice(2)}` },
			{
				variant: "binary" as const,
				size: 6,
				givens: `111${BINARY_EMPTY.slice(3)}`,
				solution: undefined,
			},
		]) {
			await expectCode(
				createPuzzle(t, overrides),
				"puzzleConflictingDigits",
			);
		}
	});

	it("answers invalidBinarySize", async () => {
		const t = setup();
		for (const size of [undefined, 7, 14]) {
			await expectCode(
				createPuzzle(t, {
						variant: "binary",
						size,
						givens: BINARY_EMPTY,
						solution: undefined,
					}),
				"invalidBinarySize",
			);
		}
	});

	it("answers invalidKillerCages and cagesUnsatisfied", async () => {
		const t = setup();
		for (const cages of [undefined, CAGES.slice(1)]) {
			await expectCode(
				createPuzzle(t, { variant: "killer", givens: EMPTY, cages }),
				"invalidKillerCages",
			);
		}
		await expectCode(
			createPuzzle(t, {
					variant: "killer",
					givens: EMPTY,
					cages: [{ sum: 9, cells: [0, 1] }, ...CAGES.slice(1)],
				}),
			"cagesUnsatisfied",
		);
	});
});

describe("getBundle", () => {
	it("strips the solution and returns no participants", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		const result = await bundle(t, sessionId);
		expect(Object.keys(result).sort()).toEqual(["session", "state"]);
		expect(result.state).not.toHaveProperty("solution");
		expect(result.state.givens).toBe(GIVENS);
	});

	it("is null without a state or a session", async () => {
		const t = setup();
		const { sessionId } = await soloSession(t);
		await expect(
			t.query(api.sudoku.getBundle, { sessionId }),
		).resolves.toBeNull();
		await expect(
			t.query(api.sudoku.getBundle, { sessionId: await deletedSessionId(t) }),
		).resolves.toBeNull();
	});
});

describe("saveProgress", () => {
	it("stores the board and restarts the timer base", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		const corner = ZEROES();
		corner[3] = 5;
		const digits = `5${EMPTY.slice(1)}`;
		advance(1000);
		await t.mutation(
			api.sudoku.saveProgress,
			progress(sessionId, {
				digits,
				cornerNotes: corner,
				autoCleanup: true,
			}),
		);
		const stored = await storedState(t, sessionId);
		expect(stored.digits).toBe(digits);
		expect(stored.cornerNotes[3]).toBe(5);
		expect(stored.elapsedSeconds).toBe(42);
		expect(stored.lastResumedAt).toBe(T0 + 1000);
		expect(stored.updatedAt).toBe(T0 + 1000);
		expect(stored.autoCleanup).toBe(true);
		await t.mutation(api.sudoku.saveProgress, progress(sessionId));
		expect((await storedState(t, sessionId)).autoCleanup).toBe(true);
	});

	it("leaves the timer stopped while paused", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		await t.mutation(api.sudoku.setPaused, { sessionId, paused: true });
		await t.mutation(api.sudoku.saveProgress, progress(sessionId));
		const stored = await storedState(t, sessionId);
		expect(stored.status).toBe("paused");
		expect(stored.lastResumedAt).toBeUndefined();
	});

	it("does nothing once completed", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		await complete(t, sessionId);
		await t.mutation(
			api.sudoku.saveProgress,
			progress(sessionId, { digits: "123" }),
		);
		const stored = await storedState(t, sessionId);
		expect(stored.digits).toBe(SOLVED);
		expect(stored.elapsedSeconds).toBe(99);
	});

	it("answers invalidPuzzleData for bad digits, notes, or colours", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		for (const overrides of [
			{ digits: "123" },
			{ cornerNotes: [0] },
			{ centerNotes: [0] },
			{ colors: [0] },
			{ colors: [512, ...ZEROES().slice(1)] },
		]) {
			await expectCode(
				t.mutation(api.sudoku.saveProgress, progress(sessionId, overrides)),
				"invalidPuzzleData",
			);
		}
	});

	it("pins that any caller can write to a session, with no identity", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		await t
			.withIdentity({ subject: "user_stranger" })
			.mutation(api.sudoku.saveProgress, progress(sessionId));
		expect((await storedState(t, sessionId)).elapsedSeconds).toBe(42);
	});

	it("answers gameNotFound without a state, on all three writers", async () => {
		const t = setup();
		const { sessionId } = await soloSession(t);
		await expectCode(
			t.mutation(api.sudoku.saveProgress, progress(sessionId)),
			"gameNotFound",
		);
		await expectCode(
			t.mutation(api.sudoku.setPaused, { sessionId, paused: true }),
			"gameNotFound",
		);
		await expectCode(complete(t, sessionId), "gameNotFound");
	});
});

describe("setPaused", () => {
	it("folds running time into elapsed on pause, rounding to seconds", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		advance(65_600);
		await t.mutation(api.sudoku.setPaused, { sessionId, paused: true });
		const paused = await storedState(t, sessionId);
		expect(paused.status).toBe("paused");
		expect(paused.elapsedSeconds).toBe(66);
		expect(paused.lastResumedAt).toBeUndefined();
		expect(paused.updatedAt).toBe(T0 + 65_600);
	});

	it("does not add time on a second pause, and restarts the timer on resume", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		advance(1000);
		await t.mutation(api.sudoku.setPaused, { sessionId, paused: true });
		advance(5000);
		await t.mutation(api.sudoku.setPaused, { sessionId, paused: true });
		expect((await storedState(t, sessionId)).elapsedSeconds).toBe(1);
		await t.mutation(api.sudoku.setPaused, { sessionId, paused: false });
		const resumed = await storedState(t, sessionId);
		expect(resumed.status).toBe("active");
		expect(resumed.elapsedSeconds).toBe(1);
		expect(resumed.lastResumedAt).toBe(T0 + 6000);
	});

	it("does nothing once completed", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		await complete(t, sessionId);
		await t.mutation(api.sudoku.setPaused, { sessionId, paused: true });
		expect((await storedState(t, sessionId)).status).toBe("completed");
	});
});

describe("complete", () => {
	it("marks state and session complete", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		advance(1000);
		await expect(complete(t, sessionId)).resolves.toEqual({ completed: true });
		const stored = await storedState(t, sessionId);
		expect(stored.status).toBe("completed");
		expect(stored.digits).toBe(SOLVED);
		expect(stored.elapsedSeconds).toBe(99);
		expect(stored.lastResumedAt).toBeUndefined();
		expect(stored.updatedAt).toBe(T0 + 1000);
		const { session } = await bundle(t, sessionId);
		expect(session.status).toBe("completed");
		expect(session.completedReason).toBe("finished");
		expect(session.endedAt).toBe(T0 + 1000);
		expect(session.participantCount).toBe(1);
		expect(session.winnerParticipantIds).toEqual([]);
	});

	it("lets givens fill the cells the digits leave blank", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		const onlyFirstRow = SOLVED.slice(0, 9) + EMPTY.slice(9);
		await expect(complete(t, sessionId, onlyFirstRow)).resolves.toEqual({
			completed: true,
		});
	});

	it("is idempotent, without validating again", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		await complete(t, sessionId);
		advance(1000);
		await expect(complete(t, sessionId, "nonsense", 1)).resolves.toEqual({
			completed: true,
		});
		const stored = await storedState(t, sessionId);
		expect(stored.digits).toBe(SOLVED);
		expect(stored.elapsedSeconds).toBe(99);
		expect((await bundle(t, sessionId)).session.endedAt).toBe(T0);
	});

	it("answers gridNotSolved for a blank or conflicting grid", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		await expectCode(complete(t, sessionId, EMPTY), "gridNotSolved");
		const clash = `55${SOLVED.slice(2)}`;
		await expectCode(complete(t, sessionId, clash), "gridNotSolved");
		expect((await storedState(t, sessionId)).status).toBe("active");
	});

	it("answers invalidPuzzleData for a malformed grid", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		await expectCode(complete(t, sessionId, "123"), "invalidPuzzleData");
	});

	it("accepts a valid grid that differs from the stored solution", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t, { givens: EMPTY });
		await expect(complete(t, sessionId, SOLVED_RELABELLED)).resolves.toEqual({
			completed: true,
		});
	});

	it("checks the cages on a killer puzzle", async () => {
		const t = setup();
		const { sessionId } = await killerPuzzle(t);
		await expectCode(complete(t, sessionId, SOLVED_RELABELLED), "gridNotSolved");
		await expect(complete(t, sessionId)).resolves.toEqual({ completed: true });
	});

	it("checks the rules on a binary puzzle", async () => {
		const t = setup();
		const { sessionId } = await binaryPuzzle(t);
		await expectCode(complete(t, sessionId, BINARY_EMPTY), "gridNotSolved");
		await expectCode(
			complete(t, sessionId, `111${BINARY_SOLVED.slice(3)}`),
			"gridNotSolved",
		);
		await expect(complete(t, sessionId, BINARY_SOLVED)).resolves.toEqual({
			completed: true,
		});
	});
});

describe("rename", () => {
	it("trims and truncates to 80 characters, with no identity", async () => {
		const t = setup();
		const { sessionId } = await soloSession(t);
		await t.mutation(api.sudoku.rename, {
			sessionId,
			title: `  ${"x".repeat(100)}  `,
		});
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.title).toBe("x".repeat(80));
	});

	it("answers titleEmpty for a blank title", async () => {
		const t = setup();
		const { sessionId } = await soloSession(t);
		await expectCode(
			t.mutation(api.sudoku.rename, { sessionId, title: "   " }),
			"titleEmpty",
		);
	});

	it("answers sessionNotFound for another game's session or a missing one", async () => {
		const t = setup();
		for (const sessionId of [
			await otherGameSession(t, "chess"),
			await deletedSessionId(t),
		]) {
			await expectCode(
				t.mutation(api.sudoku.rename, { sessionId, title: "x" }),
				"sessionNotFound",
			);
		}
	});
});

describe("create", () => {
	it("lets a guest solve alone, already started, with no way in for others", async () => {
		const t = setup();
		const created = await createPuzzle(t);
		expect(created.joinCode).toBeUndefined();
		expect(created.shareToken).toBeUndefined();
		const session = await getDoc(t, created.sessionId);
		expect(session?.status).toBe("active");
		expect(session?.startedAt).toBe(T0);
		expect((await bundle(t, created.sessionId))?.state?.givens).toBe(GIVENS);
	});

	it.each([
		"classic",
		"killer",
		"binary",
	] as const)("stores a %s puzzle from the shared generator, solvable by its solution", async (variant) => {
		const t = setup();
		const puzzle = generateVariantPuzzle(variant, "easy");
		const givens = digitsToString(puzzle.givens);
		const { sessionId } = await t.mutation(api.sudoku.create, {
			title: "Puzzle",
			displayName: "Solver",
			guestId: "guest_solver",
			source: "generated",
			difficulty: "easy",
			variant: puzzle.variant,
			size: puzzle.variant === "binary" ? puzzle.size : undefined,
			cages: puzzle.variant === "killer" ? puzzle.cages : undefined,
			givens,
			solution: digitsToString(puzzle.solution),
		});
		const stored = await storedState(t, sessionId);
		expect(stored.variant ?? "classic").toBe(variant);
		expect(stored.givens).toBe(givens);
		await expect(
			complete(t, sessionId, digitsToString(puzzle.solution)),
		).resolves.toEqual({ completed: true });
	});

	it("leaves no session behind when the puzzle is rejected", async () => {
		const t = setup();
		await expectCode(
			createPuzzle(t, { variant: "killer" }),
			"invalidKillerCages",
		);
		expect(await sessionCount(t)).toBe(0);
	});
});
