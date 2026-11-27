import { digitsToString } from "@arcadeclub/core/puzzle";
import { generateVariantPuzzle } from "@arcadeclub/core/sudoku-variants";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	advance,
	afterCommits,
	deletedSessionId,
	expectCode,
	fields,
	freezeClock,
	getDoc,
	guestIdOf,
	otherGameSession,
	type SessionId,
	sessionCount,
	setup,
	type T,
	T0,
} from "./test.helpers";

freezeClock();

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

/** The guest id `createPuzzle` and `soloSession` start their puzzles with. */
const SOLVER = guestIdOf("solver");

/** A solo session with no puzzle yet, which `create` never leaves behind. */
async function soloSession(t: T) {
	return await t.mutation(api.sessions.create, {
		gameType: "sudoku",
		joinMode: "solo",
		authPolicy: "guestAllowed",
		title: "Puzzle",
		displayName: "Solver",
		guestId: SOLVER,
	});
}

/** Sudoku is solo, so a guest hosts it. */
function createPuzzle(
	t: T,
	overrides: {
		guestId?: string | undefined;
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
		guestId: SOLVER,
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
		guestId: SOLVER,
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
	return t.mutation(api.sudoku.complete, {
		sessionId,
		guestId: SOLVER,
		digits,
		elapsedSeconds,
	});
}

async function storedState(t: T, sessionId: SessionId) {
	return (await t.run((ctx) =>
		ctx.db
			.query("sudokuStates")
			.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
			.unique(),
	)) as Doc<"sudokuStates">;
}

/** The bundle as the guest who started the puzzle reads it. */
async function bundle(t: T, sessionId: SessionId) {
	const result = await t.query(api.sudoku.getBundle, {
		sessionId,
		guestId: SOLVER,
	});
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
		const session = (await getDoc(t, sessionId)) as Doc<"gameSessions">;
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

	it("answers guestIdInvalid for a guest with an empty, short, or missing id", async () => {
		const t = setup();
		for (const guestId of ["", "guest_", "guest_1a2b3c4d", "not-a-guest-id"]) {
			await expectCode(createPuzzle(t, { guestId }), "guestIdInvalid");
		}
		await expectCode(createPuzzle(t, { guestId: undefined }), "guestIdInvalid");
		await expectCode(
			t.mutation(api.sessions.create, {
				gameType: "sudoku",
				joinMode: "solo",
				authPolicy: "guestAllowed",
				title: "Puzzle",
				displayName: "Solver",
				guestId: "",
			}),
			"guestIdInvalid",
		);
		expect(await sessionCount(t)).toBe(0);
	});

	it("needs no guest id from a signed-in host", async () => {
		const t = setup();
		const host = t.withIdentity({ subject: "user_signed_in" });
		for (const guestId of [undefined, ""]) {
			const { sessionId } = await host.mutation(api.sudoku.create, {
				title: "Puzzle",
				displayName: "Solver",
				guestId,
				source: "generated",
				givens: GIVENS,
			});
			await expect(
				host.query(api.sudoku.getBundle, { sessionId }),
			).resolves.not.toBeNull();
		}
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
			await expectCode(createPuzzle(t, overrides), "invalidPuzzleData");
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
			await expectCode(createPuzzle(t, overrides), "puzzleConflictingDigits");
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
			t.query(api.sudoku.getBundle, {
				sessionId,
				guestId: SOLVER,
			}),
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
		await t.mutation(api.sudoku.setPaused, {
			sessionId,
			guestId: SOLVER,
			paused: true,
		});
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

	describe("against a newer board", () => {
		const PHONE = `5${EMPTY.slice(1)}`;
		const WEB = `53${EMPTY.slice(2)}`;

		/** A puzzle the web has saved since the phone loaded it. */
		async function webSavedSince(t: T) {
			const { sessionId, updatedAt } = await createPuzzle(t);
			advance(1000);
			const web = await t.mutation(
				api.sudoku.saveProgress,
				progress(sessionId, { digits: WEB, baseUpdatedAt: updatedAt }),
			);
			return { sessionId, stale: updatedAt, web };
		}

		it("refuses a stale base and leaves the stored board unchanged", async () => {
			const t = setup();
			const { sessionId, stale, web } = await webSavedSince(t);
			const before = await storedState(t, sessionId);
			advance(1000);
			await expect(
				t.mutation(
					api.sudoku.saveProgress,
					progress(sessionId, {
						digits: PHONE,
						elapsedSeconds: 7,
						baseUpdatedAt: stale,
					}),
				),
			).resolves.toEqual({ saved: false, updatedAt: web.updatedAt });
			expect(await storedState(t, sessionId)).toEqual(before);
		});

		it.each(["cornerNotes", "centerNotes", "colors"])(
			"refuses a stale base whose board differs only in %s",
			async (field) => {
				const t = setup();
				const { sessionId, stale } = await webSavedSince(t);
				const before = await storedState(t, sessionId);
				const masks = ZEROES();
				masks[7] = 1;
				const answer = await t.mutation(
					api.sudoku.saveProgress,
					progress(sessionId, {
						digits: WEB,
						[field]: masks,
						baseUpdatedAt: stale,
					}),
				);
				expect(answer.saved).toBe(false);
				expect(await storedState(t, sessionId)).toEqual(before);
			},
		);

		it("saves on a fresh base, and on each answer after it", async () => {
			const t = setup();
			const { sessionId, updatedAt } = await createPuzzle(t);
			let baseUpdatedAt = updatedAt;
			// All in one millisecond: each is still a version of its own.
			for (const digits of [PHONE, WEB, EMPTY]) {
				const answer = await t.mutation(
					api.sudoku.saveProgress,
					progress(sessionId, { digits, baseUpdatedAt }),
				);
				expect(answer.saved).toBe(true);
				expect(answer.updatedAt).toBeGreaterThan(baseUpdatedAt);
				baseUpdatedAt = answer.updatedAt;
				const stored = await storedState(t, sessionId);
				expect(stored.digits).toBe(digits);
				expect(stored.updatedAt).toBe(baseUpdatedAt);
			}
		});

		it("saves with no base, as installed builds send it", async () => {
			const t = setup();
			const { sessionId, web } = await webSavedSince(t);
			advance(1000);
			const answer = await t.mutation(
				api.sudoku.saveProgress,
				progress(sessionId, { digits: PHONE }),
			);
			expect(answer.saved).toBe(true);
			expect(answer.updatedAt).toBeGreaterThan(web.updatedAt);
			expect((await storedState(t, sessionId)).digits).toBe(PHONE);
		});

		it("takes a stale base with the same board, without a new version", async () => {
			const t = setup();
			const { sessionId, stale, web } = await webSavedSince(t);
			advance(1000);
			await expect(
				t.mutation(
					api.sudoku.saveProgress,
					progress(sessionId, {
						digits: WEB,
						elapsedSeconds: 50,
						baseUpdatedAt: stale,
					}),
				),
			).resolves.toEqual({ saved: true, updatedAt: web.updatedAt });
			expect((await storedState(t, sessionId)).elapsedSeconds).toBe(50);
		});

		it("never lowers the clock from a stale base with the same board", async () => {
			const t = setup();
			const { sessionId, stale } = await webSavedSince(t);
			// The web has played on: 42 s at save, plus 10 s since.
			advance(10_000);
			await expect(
				t.mutation(
					api.sudoku.saveProgress,
					progress(sessionId, {
						digits: WEB,
						elapsedSeconds: 5,
						baseUpdatedAt: stale,
					}),
				),
			).resolves.toMatchObject({ saved: true });
			const stored = await storedState(t, sessionId);
			expect(stored.elapsedSeconds).toBe(52);
			expect(stored.lastResumedAt).toBe(Date.now());
		});

		it("keeps a base fresh across pause and resume", async () => {
			const t = setup();
			const { sessionId, web } = await webSavedSince(t);
			for (const paused of [true, false]) {
				advance(1000);
				await t.mutation(api.sudoku.setPaused, {
					sessionId,
					guestId: SOLVER,
					paused,
				});
			}
			const answer = await t.mutation(
				api.sudoku.saveProgress,
				progress(sessionId, { digits: PHONE, baseUpdatedAt: web.updatedAt }),
			);
			expect(answer.saved).toBe(true);
		});

		it("refuses any base once completed", async () => {
			const t = setup();
			const { sessionId, updatedAt } = await createPuzzle(t);
			await complete(t, sessionId);
			const stored = await storedState(t, sessionId);
			expect(stored.updatedAt).toBeGreaterThan(updatedAt);
			await expect(
				t.mutation(
					api.sudoku.saveProgress,
					progress(sessionId, { baseUpdatedAt: updatedAt }),
				),
			).resolves.toEqual({ saved: false, updatedAt: stored.updatedAt });
		});
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

	it("answers gameNotFound without a state, on all three writers", async () => {
		const t = setup();
		const { sessionId } = await soloSession(t);
		await expectCode(
			t.mutation(api.sudoku.saveProgress, progress(sessionId)),
			"gameNotFound",
		);
		await expectCode(
			t.mutation(api.sudoku.setPaused, {
				sessionId,
				guestId: SOLVER,
				paused: true,
			}),
			"gameNotFound",
		);
		await expectCode(complete(t, sessionId), "gameNotFound");
	});
});

describe("only the host writes", () => {
	const OWNER = "user_owner";

	/** Every write a puzzle takes, as `caller` with `guestId`. */
	function writes(
		caller: Pick<T, "mutation">,
		sessionId: SessionId,
		guestId?: string,
	) {
		return {
			saveProgress: () =>
				caller.mutation(
					api.sudoku.saveProgress,
					progress(sessionId, { guestId }),
				),
			setPaused: () =>
				caller.mutation(api.sudoku.setPaused, {
					sessionId,
					guestId,
					paused: true,
				}),
			keepClock: () =>
				caller.mutation(api.sudoku.keepClock, { sessionId, guestId }),
			rename: () =>
				caller.mutation(api.sudoku.rename, {
					sessionId,
					guestId,
					title: "Mine now",
				}),
			complete: () =>
				caller.mutation(api.sudoku.complete, {
					sessionId,
					guestId,
					digits: SOLVED,
					elapsedSeconds: 99,
				}),
		};
	}

	function accountPuzzle(t: T) {
		return t.withIdentity({ subject: OWNER }).mutation(api.sudoku.create, {
			title: "Puzzle",
			displayName: "Solver",
			guestId: SOLVER,
			source: "generated",
			difficulty: "easy",
			givens: GIVENS,
			solution: SOLVED,
		});
	}

	async function expectUntouched(t: T, sessionId: SessionId) {
		const stored = await storedState(t, sessionId);
		expect(stored.status).toBe("active");
		expect(stored.elapsedSeconds).toBe(0);
		expect((await getDoc(t, sessionId))?.title).toBe("Puzzle");
	}

	it("lets the account that started a puzzle write it", async () => {
		const t = setup();
		const { sessionId } = await accountPuzzle(t);
		const owner = writes(t.withIdentity({ subject: OWNER }), sessionId);
		await owner.saveProgress();
		await owner.setPaused();
		await owner.rename();
		await expect(owner.complete()).resolves.toEqual({ completed: true });
		expect((await storedState(t, sessionId)).status).toBe("completed");
		expect((await getDoc(t, sessionId))?.title).toBe("Mine now");
	});

	it("answers hostOnly to another account, even holding the guest id", async () => {
		const t = setup();
		const { sessionId } = await accountPuzzle(t);
		const stranger = t.withIdentity({ subject: "user_stranger" });
		for (const guestId of [undefined, SOLVER]) {
			for (const write of Object.values(writes(stranger, sessionId, guestId))) {
				await expectCode(write(), "hostOnly");
			}
		}
		await expectUntouched(t, sessionId);
	});

	it("answers hostOnly to a signed-out caller on an account's puzzle", async () => {
		const t = setup();
		const { sessionId } = await accountPuzzle(t);
		for (const guestId of [undefined, SOLVER]) {
			for (const write of Object.values(writes(t, sessionId, guestId))) {
				await expectCode(write(), "hostOnly");
			}
		}
		await expectUntouched(t, sessionId);
	});

	it("lets the guest who started a puzzle write it with their guest id, signed in or not", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		const guest = writes(t, sessionId, SOLVER);
		await guest.saveProgress();
		await guest.setPaused();
		// A guest who signs in later still holds the puzzle they started.
		await writes(
			t.withIdentity({ subject: "user_later" }),
			sessionId,
			SOLVER,
		).rename();
		await expect(guest.complete()).resolves.toEqual({ completed: true });
		expect((await storedState(t, sessionId)).status).toBe("completed");
		expect((await getDoc(t, sessionId))?.title).toBe("Mine now");
	});

	it("answers hostOnly to a wrong guest id on a guest's puzzle, signed in or not", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		for (const caller of [t, t.withIdentity({ subject: "user_stranger" })]) {
			for (const write of Object.values(
				writes(caller, sessionId, guestIdOf("other")),
			)) {
				await expectCode(write(), "hostOnly");
			}
		}
		await expectUntouched(t, sessionId);
	});

	it("answers hostOnly to no guest id on a guest's puzzle, signed in or not", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		for (const caller of [t, t.withIdentity({ subject: "user_stranger" })]) {
			for (const write of Object.values(writes(caller, sessionId))) {
				await expectCode(write(), "hostOnly");
			}
		}
		await expectUntouched(t, sessionId);
	});

	it("checks the host before treating a completed puzzle as done", async () => {
		const t = setup();
		const { sessionId } = await accountPuzzle(t);
		await writes(t.withIdentity({ subject: OWNER }), sessionId).complete();
		for (const write of Object.values(writes(t, sessionId))) {
			await expectCode(write(), "hostOnly");
		}
	});
});

describe("only the host reads", () => {
	const OWNER = "user_owner";

	function accountPuzzle(t: T) {
		return t.withIdentity({ subject: OWNER }).mutation(api.sudoku.create, {
			title: "Puzzle",
			displayName: "Solver",
			source: "generated",
			difficulty: "easy",
			givens: GIVENS,
			solution: SOLVED,
		});
	}

	function read(
		caller: Pick<T, "query">,
		sessionId: SessionId,
		guestId?: string,
	) {
		return caller.query(api.sudoku.getBundle, { sessionId, guestId });
	}

	it("gives the account that started a puzzle its board, without the solution", async () => {
		const t = setup();
		const { sessionId } = await accountPuzzle(t);
		const result = await read(t.withIdentity({ subject: OWNER }), sessionId);
		expect(result?.state.givens).toBe(GIVENS);
		expect(result?.state).not.toHaveProperty("solution");
		expect(result?.session).toEqual({ _id: sessionId, title: "Puzzle" });
		expect(result?.session).not.toHaveProperty("hostUserId");
	});

	it("is null for another account, even holding the guest id", async () => {
		const t = setup();
		const { sessionId } = await accountPuzzle(t);
		const stranger = t.withIdentity({ subject: "user_stranger" });
		for (const guestId of [undefined, SOLVER]) {
			await expect(read(stranger, sessionId, guestId)).resolves.toBeNull();
		}
	});

	it("is null for a signed-out caller on an account's puzzle", async () => {
		const t = setup();
		const { sessionId } = await accountPuzzle(t);
		for (const guestId of [undefined, SOLVER]) {
			await expect(read(t, sessionId, guestId)).resolves.toBeNull();
		}
	});

	it("gives the guest who started a puzzle its board with their guest id, signed in or not", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		for (const caller of [t, t.withIdentity({ subject: "user_later" })]) {
			const result = await read(caller, sessionId, SOLVER);
			expect(result?.state.givens).toBe(GIVENS);
			expect(result?.session).toEqual({ _id: sessionId, title: "Puzzle" });
			expect(result?.session).not.toHaveProperty("hostUserId");
		}
	});

	it("is null for a wrong guest id on a guest's puzzle, signed in or not", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		for (const caller of [t, t.withIdentity({ subject: "user_stranger" })]) {
			await expect(
				read(caller, sessionId, guestIdOf("other")),
			).resolves.toBeNull();
		}
	});

	it("is null for no guest id on a guest's puzzle, signed in or not", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		for (const caller of [t, t.withIdentity({ subject: "user_stranger" })]) {
			await expect(read(caller, sessionId)).resolves.toBeNull();
		}
	});

	it("never sends the host's account id to anyone else", async () => {
		const t = setup();
		const { sessionId } = await accountPuzzle(t);
		const results = [
			await read(t, sessionId),
			await read(t, sessionId, SOLVER),
			await read(t.withIdentity({ subject: "user_stranger" }), sessionId),
		];
		expect(JSON.stringify(results)).not.toContain(OWNER);
	});

	it("is null for a session of another game", async () => {
		const t = setup();
		const sessionId = await otherGameSession(t, "live-quiz");
		await expect(read(t, sessionId)).resolves.toBeNull();
	});
});

describe("setPaused", () => {
	it("folds running time into elapsed on pause, rounding to seconds", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		advance(65_600);
		await t.mutation(api.sudoku.setPaused, {
			sessionId,
			guestId: SOLVER,
			paused: true,
		});
		const paused = await storedState(t, sessionId);
		expect(paused.status).toBe("paused");
		expect(paused.elapsedSeconds).toBe(66);
		expect(paused.lastResumedAt).toBeUndefined();
		// The board did not change, so its version does not either.
		expect(paused.updatedAt).toBe(T0);
	});

	it("does not add time on a second pause, and restarts the timer on resume", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		advance(1000);
		await t.mutation(api.sudoku.setPaused, {
			sessionId,
			guestId: SOLVER,
			paused: true,
		});
		advance(5000);
		await t.mutation(api.sudoku.setPaused, {
			sessionId,
			guestId: SOLVER,
			paused: true,
		});
		expect((await storedState(t, sessionId)).elapsedSeconds).toBe(1);
		await t.mutation(api.sudoku.setPaused, {
			sessionId,
			guestId: SOLVER,
			paused: false,
		});
		const resumed = await storedState(t, sessionId);
		expect(resumed.status).toBe("active");
		expect(resumed.elapsedSeconds).toBe(1);
		expect(resumed.lastResumedAt).toBe(afterCommits(T0 + 6000));
	});

	it("does nothing once completed", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		await complete(t, sessionId);
		await t.mutation(api.sudoku.setPaused, {
			sessionId,
			guestId: SOLVER,
			paused: true,
		});
		expect((await storedState(t, sessionId)).status).toBe("completed");
	});
});

describe("keepClock", () => {
	function keepClock(t: T, sessionId: SessionId) {
		return t.mutation(api.sudoku.keepClock, { sessionId, guestId: SOLVER });
	}

	it("folds a running clock and restarts the timer base, without a new version", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		advance(10 * 60_000);
		await keepClock(t, sessionId);
		const kept = await storedState(t, sessionId);
		expect(kept.status).toBe("active");
		expect(kept.elapsedSeconds).toBe(600);
		expect(kept.lastResumedAt).toBe(T0 + 600_000);
		expect(kept.updatedAt).toBe(T0);
	});

	it("leaves no more than a minute for a phone to fold, so it keeps the web's time", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		// Ten minutes on the web without a board change, heartbeat each minute.
		for (let minute = 0; minute < 10; minute++) {
			advance(60_000);
			await keepClock(t, sessionId);
		}
		const { state } = await bundle(t, sessionId);
		// What the phone folds (at most five minutes) starts from here.
		expect(state.elapsedSeconds).toBe(600);
		expect(Date.now() - (state.lastResumedAt ?? 0)).toBeLessThan(60_000);
	});

	it("does nothing while paused or once completed", async () => {
		const t = setup();
		const { sessionId } = await createPuzzle(t);
		advance(1000);
		await t.mutation(api.sudoku.setPaused, {
			sessionId,
			guestId: SOLVER,
			paused: true,
		});
		advance(60_000);
		await keepClock(t, sessionId);
		const paused = await storedState(t, sessionId);
		expect(paused.elapsedSeconds).toBe(1);
		expect(paused.lastResumedAt).toBeUndefined();
		await complete(t, sessionId);
		await keepClock(t, sessionId);
		const completed = await storedState(t, sessionId);
		expect(completed.status).toBe("completed");
		expect(completed.elapsedSeconds).toBe(99);
		expect(completed.lastResumedAt).toBeUndefined();
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
		const session = (await getDoc(t, sessionId)) as Doc<"gameSessions">;
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
		expect((await getDoc(t, sessionId))?.endedAt).toBe(T0);
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
		await expectCode(
			complete(t, sessionId, SOLVED_RELABELLED),
			"gridNotSolved",
		);
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
	it("trims and truncates to 80 characters", async () => {
		const t = setup();
		const { sessionId } = await soloSession(t);
		await t.mutation(api.sudoku.rename, {
			sessionId,
			guestId: SOLVER,
			title: `  ${"x".repeat(100)}  `,
		});
		const session = await t.run((ctx) => ctx.db.get(sessionId));
		expect(session?.title).toBe("x".repeat(80));
	});

	it("answers titleEmpty for a blank title", async () => {
		const t = setup();
		const { sessionId } = await soloSession(t);
		await expectCode(
			t.mutation(api.sudoku.rename, {
				sessionId,
				guestId: SOLVER,
				title: "   ",
			}),
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
				t.mutation(api.sudoku.rename, {
					sessionId,
					guestId: SOLVER,
					title: "x",
				}),
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

	it.each(["classic", "killer", "binary"] as const)(
		"stores a %s puzzle from the shared generator, solvable by its solution",
		async (variant) => {
			const t = setup();
			const puzzle = generateVariantPuzzle(variant, "easy");
			const givens = digitsToString(puzzle.givens);
			const { sessionId } = await t.mutation(api.sudoku.create, {
				title: "Puzzle",
				displayName: "Solver",
				guestId: SOLVER,
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
		},
	);

	it("leaves no session behind when the puzzle is rejected", async () => {
		const t = setup();
		await expectCode(
			createPuzzle(t, { variant: "killer" }),
			"invalidKillerCages",
		);
		expect(await sessionCount(t)).toBe(0);
	});
});
