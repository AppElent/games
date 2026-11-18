import {
	createBoardState,
	serializeBoard,
} from "@arcadeclub/core/sudoku-board";
import { ConvexError } from "convex/values";
import type { Id } from "../../../convex/api";
import {
	type AccountSession,
	type CloudBundle,
	createSyncRunner,
	type SudokuCloud,
	type SyncAccount,
	saveFromBundle,
	syncSudokuSaves,
} from "./sudoku-cloud-sync";
import {
	deleteSudokuSave,
	type GridSave,
	hiddenSudokuSessions,
	listSudokuSaves,
	readSudokuSave,
	writeSudokuSave,
} from "./sudoku-save-store";

const ME = "user_me";
const SESSION = "session_1" as Id<"gameSessions">;

function gridSave(id: string, updatedAt: number, digit = 0): GridSave {
	const givens = new Array(81).fill(0);
	givens[0] = 5;
	const board = serializeBoard(createBoardState(givens));
	return {
		id,
		variant: "classic",
		difficulty: "easy",
		updatedAt,
		elapsedSeconds: 10,
		status: "active",
		board: { ...board, digits: `0${digit}${"0".repeat(79)}` },
		solution: "1".repeat(81),
		autoCleanup: true,
	};
}

function account(overrides: Partial<SyncAccount> = {}): SyncAccount {
	return {
		userId: ME,
		displayName: "Me",
		titleOf: () => "Classic · Easy",
		isCurrent: () => true,
		...overrides,
	};
}

/** A server that answers at once, recording each call. */
function fakeCloud(overrides: Partial<SudokuCloud> = {}) {
	const calls: { name: string; args: unknown }[] = [];
	const record =
		(name: string, answer: unknown = null) =>
		async (args: unknown) => {
			calls.push({ name, args });
			return answer;
		};
	const cloud: SudokuCloud = {
		create: record("create", { sessionId: SESSION }) as SudokuCloud["create"],
		saveProgress: record("saveProgress"),
		setPaused: record("setPaused"),
		complete: record("complete"),
		listSessions: async () => [],
		getBundle: async () => null,
		...overrides,
	};
	const names = () => calls.map((call) => call.name);
	return { cloud, calls, names };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

describe("sudoku cloud sync", () => {
	beforeEach(() => {
		for (const owner of [null, ME, "user_other"]) {
			for (const item of listSudokuSaves(owner)) deleteSudokuSave(item.id);
		}
	});

	it("uploads a guest save once, then marks it synced", async () => {
		writeSudokuSave(gridSave("a", 1, 3));
		const { cloud, calls, names } = fakeCloud();
		await syncSudokuSaves(account(), cloud, { now: () => 100 });
		expect(names()).toEqual(["create", "saveProgress", "setPaused"]);
		// The player's digits go with the progress save, never with create.
		expect(calls[0].args).not.toHaveProperty("digits");
		expect(calls[0].args).toMatchObject({
			title: "Classic · Easy",
			displayName: "Me",
			source: "generated",
			givens: gridSave("a", 1).board.givens,
		});
		expect(calls[1].args).toMatchObject({
			sessionId: SESSION,
			digits: gridSave("a", 1, 3).board.digits,
			elapsedSeconds: 10,
		});
		expect(calls[2].args).toEqual({ sessionId: SESSION, paused: true });
		expect(readSudokuSave("a")?.cloud).toEqual({
			userId: ME,
			sessionId: SESSION,
			synced: true,
			title: "Classic · Easy",
		});

		await syncSudokuSaves(account(), cloud);
		expect(names()).toHaveLength(3);
	});

	it("leaves a guest's saves alone until someone signs in", () => {
		writeSudokuSave(gridSave("a", 1));
		expect(readSudokuSave("a")?.cloud).toBeUndefined();
		expect(listSudokuSaves(null).map((item) => item.id)).toEqual(["a"]);
	});

	it("never sends another account's saves", async () => {
		writeSudokuSave({
			...gridSave("theirs", 1),
			cloud: { userId: "user_other", synced: false },
		});
		const { cloud, names } = fakeCloud();
		await syncSudokuSaves(account(), cloud);
		expect(names()).toEqual([]);
		expect(readSudokuSave("theirs")?.cloud?.userId).toBe("user_other");
	});

	it("keeps a save whose upload fails and retries it on the next run", async () => {
		writeSudokuSave(gridSave("a", 1));
		const errors: unknown[] = [];
		const failing = fakeCloud({
			create: async () => {
				throw new Error("network");
			},
		});
		await syncSudokuSaves(account(), failing.cloud, {
			onError: (error) => errors.push(error),
		});
		expect(errors).toHaveLength(1);
		const kept = readSudokuSave("a");
		expect(kept?.cloud).toMatchObject({ userId: ME, synced: false });
		expect(kept?.cloud?.sessionId).toBeUndefined();

		const { cloud, names } = fakeCloud();
		await syncSudokuSaves(account(), cloud);
		expect(names()).toEqual(["create", "saveProgress", "setPaused"]);
		expect(readSudokuSave("a")?.cloud?.synced).toBe(true);
	});

	it("sends moves made offline, after the create comes back, without a second create", async () => {
		writeSudokuSave(gridSave("a", 1));
		const answer = deferred<{ sessionId: Id<"gameSessions"> }>();
		const { cloud, calls, names } = fakeCloud({
			create: async () => {
				calls.push({ name: "create", args: null });
				return answer.promise;
			},
		});
		const runner = createSyncRunner(() => syncSudokuSaves(account(), cloud));
		const first = runner.request();
		await Promise.resolve();
		// Offline: the create waits; the player keeps playing.
		writeSudokuSave(gridSave("a", 2, 7));
		void runner.request();
		void runner.request();
		answer.resolve({ sessionId: SESSION });
		await first;
		expect(names().filter((name) => name === "create")).toHaveLength(1);
		const progress = calls.filter((call) => call.name === "saveProgress");
		expect(progress.at(-1)?.args).toMatchObject({
			digits: gridSave("a", 2, 7).board.digits,
		});
		expect(readSudokuSave("a")?.cloud).toMatchObject({
			sessionId: SESSION,
			synced: true,
		});
	});

	it("keeps a save unsynced when a move lands while it is being sent", async () => {
		writeSudokuSave({
			...gridSave("a", 1),
			cloud: { userId: ME, sessionId: SESSION, synced: false },
		});
		const { cloud } = fakeCloud({
			saveProgress: async () => {
				writeSudokuSave(gridSave("a", 5, 9));
			},
		});
		await syncSudokuSaves(account(), cloud);
		expect(readSudokuSave("a")?.cloud?.synced).toBe(false);
	});

	it("finds the session a create made before the app closed, instead of making another", async () => {
		writeSudokuSave({
			...gridSave("a", 1),
			cloud: {
				userId: ME,
				synced: false,
				createStartedAt: 1_000_000,
				title: "Classic · Easy",
			},
		});
		const sessions: AccountSession[] = [
			{
				sessionId: "older" as Id<"gameSessions">,
				title: "Classic · Easy",
				status: "active",
				createdAt: 1,
			},
			{
				sessionId: SESSION,
				title: "Classic · Easy",
				status: "active",
				createdAt: 1_000_500,
			},
		];
		const bundles: Id<"gameSessions">[] = [];
		const { cloud, names } = fakeCloud({
			listSessions: async () => sessions,
			getBundle: async (sessionId) => {
				bundles.push(sessionId);
				return {
					state: { givens: gridSave("a", 1).board.givens },
				} as CloudBundle;
			},
		});
		await syncSudokuSaves(account(), cloud);
		expect(bundles).toEqual([SESSION]);
		expect(names()).toEqual(["saveProgress", "setPaused"]);
		expect(readSudokuSave("a")?.cloud).toMatchObject({
			sessionId: SESSION,
			synced: true,
		});
		expect(readSudokuSave("a")?.cloud?.createStartedAt).toBeUndefined();
	});

	it("creates the session when an unanswered create never reached the server", async () => {
		writeSudokuSave({
			...gridSave("a", 1),
			cloud: {
				userId: ME,
				synced: false,
				createStartedAt: 1_000_000,
				title: "Classic · Easy",
			},
		});
		const { cloud, names } = fakeCloud({
			listSessions: async () => [
				{
					sessionId: "other" as Id<"gameSessions">,
					title: "Classic · Easy",
					status: "active",
					createdAt: 1_000_500,
				},
			],
			getBundle: async () =>
				({ state: { givens: "9".repeat(81) } }) as CloudBundle,
		});
		await syncSudokuSaves(account(), cloud);
		expect(names()).toEqual(["create", "saveProgress", "setPaused"]);
	});

	it("completes a solved puzzle", async () => {
		writeSudokuSave({ ...gridSave("a", 1), status: "completed" });
		const { cloud, calls, names } = fakeCloud();
		await syncSudokuSaves(account(), cloud);
		expect(names()).toEqual(["create", "saveProgress", "complete"]);
		expect(calls[2].args).toMatchObject({ sessionId: SESSION });
	});

	it("re-creates a session the server no longer has, keeping the puzzle", async () => {
		writeSudokuSave({
			...gridSave("a", 1),
			cloud: { userId: ME, sessionId: "gone", synced: false },
		});
		const gone = fakeCloud({
			saveProgress: async () => {
				throw new ConvexError({ code: "gameNotFound" });
			},
		});
		await syncSudokuSaves(account(), gone.cloud);
		expect(readSudokuSave("a")?.cloud).toMatchObject({
			userId: ME,
			synced: false,
		});
		expect(readSudokuSave("a")?.cloud?.sessionId).toBeUndefined();

		const { cloud, names } = fakeCloud();
		await syncSudokuSaves(account(), cloud);
		expect(names()).toEqual(["create", "saveProgress", "setPaused"]);
	});

	it("hides a session whose save was deleted while it was created", async () => {
		writeSudokuSave(gridSave("a", 1));
		const { cloud } = fakeCloud({
			create: async () => {
				deleteSudokuSave("a");
				return { sessionId: SESSION };
			},
		});
		await syncSudokuSaves(account(), cloud);
		expect(hiddenSudokuSessions().has(SESSION)).toBe(true);
	});

	it("stops when the player signs out mid-run", async () => {
		writeSudokuSave(gridSave("a", 1));
		writeSudokuSave(gridSave("b", 2));
		let signedIn = true;
		const { cloud, names } = fakeCloud({
			create: async () => {
				signedIn = false;
				return { sessionId: SESSION };
			},
		});
		await syncSudokuSaves(account({ isCurrent: () => signedIn }), cloud, {
			now: () => 1_000_000,
		});
		expect(names()).toEqual([]);
		// The answer may belong to whoever signs in next, so it is not linked;
		// the start time stays for the owner's next run to look it up.
		expect(readSudokuSave("a")?.cloud?.sessionId).toBeUndefined();
		expect(readSudokuSave("a")?.cloud?.createStartedAt).toBe(1_000_000);

		deleteSudokuSave("b");
		const back = fakeCloud({
			listSessions: async () => [
				{
					sessionId: SESSION,
					title: "Classic · Easy",
					status: "active",
					createdAt: 1_000_100,
				},
			],
			getBundle: async () =>
				({ state: { givens: gridSave("a", 1).board.givens } }) as CloudBundle,
		});
		await syncSudokuSaves(account(), back.cloud);
		expect(back.names()).not.toContain("create");
		expect(readSudokuSave("a")?.cloud?.sessionId).toBe(SESSION);
	});

	it("runs one sync at a time and queues one more for requests meanwhile", async () => {
		const gate = deferred<void>();
		let runs = 0;
		const runner = createSyncRunner(async () => {
			runs += 1;
			if (runs === 1) await gate.promise;
		});
		const first = runner.request();
		void runner.request();
		void runner.request();
		gate.resolve();
		await first;
		expect(runs).toBe(2);
	});
});

describe("saveFromBundle", () => {
	const state = {
		status: "active",
		variant: undefined,
		givens: "5".padEnd(81, "0"),
		digits: "0".repeat(81),
		cornerNotes: new Array(81).fill(0),
		centerNotes: new Array(81).fill(0),
		colors: new Array(81).fill(0),
		autoCleanup: false,
		elapsedSeconds: 30,
		lastResumedAt: 10_000,
		updatedAt: 9_000,
		difficulty: "hard",
	};
	const bundle = {
		session: { _id: SESSION, title: "Hard sudoku · Nov 18" },
		state,
	} as unknown as CloudBundle;

	it("turns an account session into a synced save the screens can open", () => {
		writeSudokuSave(
			saveFromBundle(bundle, { id: SESSION, userId: ME, now: 25_000 }),
		);
		const save = readSudokuSave(SESSION);
		expect(save).toMatchObject({
			variant: "classic",
			difficulty: "hard",
			// The 15 s it ran since its last resume count too.
			elapsedSeconds: 45,
			status: "active",
		});
		expect(save?.variant === "classic" && save.solution).toBeUndefined();
	});

	it("reads a binary session", () => {
		const binary = {
			session: { _id: SESSION, title: "Binary" },
			state: {
				...state,
				variant: "binary",
				size: 6,
				givens: "0".repeat(36),
				digits: "1".repeat(36),
				status: "completed",
				lastResumedAt: undefined,
			},
		} as unknown as CloudBundle;
		expect(
			saveFromBundle(binary, { id: "b", userId: ME, now: 0 }),
		).toMatchObject({
			variant: "binary",
			size: 6,
			entries: "1".repeat(36),
			status: "completed",
			elapsedSeconds: 30,
			cloud: { userId: ME, sessionId: SESSION, synced: true, title: "Binary" },
		});
	});
});
