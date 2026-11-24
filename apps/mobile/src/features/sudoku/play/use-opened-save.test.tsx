import { useAuth } from "@clerk/expo";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useConvex, useConvexAuth } from "convex/react";
import type { Id } from "../../../convex/api";
import { readGuestIdentity } from "../../players/identity/use-player-identity";
import { type CloudBundle, saveFromBundle } from "../saves/sudoku-cloud-sync";
import {
	deleteSudokuSave,
	findSudokuSaveBySession,
	listSudokuSaves,
	storeSyncedSave,
	writeSudokuSave,
} from "../saves/sudoku-save-store";
import { useOpenedSave } from "./use-opened-save";

// The shared mocks sign everyone out; this test steers who is signed in.
jest.mock("@clerk/expo", () => ({
	useAuth: jest.fn(),
	useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
}));
jest.mock("convex/react", () => ({
	...jest.requireActual("convex/react"),
	useConvex: jest.fn(),
	useConvexAuth: jest.fn(),
}));

const SESSION = "session_a" as Id<"gameSessions">;
const ALICE = "user_alice";
const BOB = "user_bob";

// What `getBundle` sends once it stops returning `hostUserId` (APP-366).
const bundle = {
	session: { _id: SESSION, title: "Alice's sudoku" },
	state: {
		status: "active",
		givens: "5".padEnd(81, "0"),
		digits: "0".repeat(81),
		cornerNotes: new Array(81).fill(0),
		centerNotes: new Array(81).fill(0),
		colors: new Array(81).fill(0),
		autoCleanup: false,
		elapsedSeconds: 30,
		updatedAt: 9_000,
		difficulty: "hard",
	},
} as unknown as CloudBundle;

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((yes) => {
		resolve = yes;
	});
	return { promise, resolve };
}

let userId = ALICE;
let answers: ReturnType<typeof deferred<CloudBundle | null>>[] = [];
let asked: unknown[] = [];

beforeEach(() => {
	for (const owner of [null, ALICE, BOB]) {
		for (const item of listSudokuSaves(owner)) deleteSudokuSave(item.id);
	}
	userId = ALICE;
	answers = [];
	asked = [];
	jest
		.mocked(useAuth)
		.mockImplementation(
			() => ({ isLoaded: true, isSignedIn: true, userId }) as never,
		);
	jest
		.mocked(useConvexAuth)
		.mockReturnValue({ isLoading: false, isAuthenticated: true } as never);
	const query = jest.fn((_ref: unknown, args: unknown) => {
		asked.push(args);
		const answer = deferred<CloudBundle | null>();
		answers.push(answer);
		return answer.promise;
	});
	jest.mocked(useConvex).mockReturnValue({ query } as never);
});

// A settled answer clears its fetch timeout, so no timer outlives the test.
afterEach(() => {
	for (const answer of answers) answer.resolve(null);
});

it("opens the account's puzzle from a bundle without hostUserId", async () => {
	const { result } = await renderHook(() => useOpenedSave(SESSION));
	await waitFor(() => expect(answers).toHaveLength(1));
	await act(async () => answers[0].resolve(bundle));
	expect(result.current).toMatchObject({
		state: "ready",
		save: { cloud: { userId: ALICE, sessionId: SESSION } },
	});
});

it("asks with the install's guest id, so a stranger's guest puzzle is refused", async () => {
	await renderHook(() => useOpenedSave(SESSION));
	await waitFor(() => expect(asked).toHaveLength(1));
	expect(asked[0]).toEqual({
		sessionId: SESSION,
		guestId: readGuestIdentity().id,
	});
});

it("shows nothing when the server has no puzzle for this account", async () => {
	const { result } = await renderHook(() => useOpenedSave(SESSION));
	await waitFor(() => expect(answers).toHaveLength(1));
	await act(async () => answers[0].resolve(null));
	expect(result.current).toEqual({ state: "missing" });
});

it("drops an answer that arrives after an account switch", async () => {
	const { result, rerender } = await renderHook(() => useOpenedSave(SESSION));
	await waitFor(() => expect(answers).toHaveLength(1));
	userId = BOB;
	await rerender({});
	await waitFor(() => expect(answers).toHaveLength(2));
	// Alice's answer lands while Bob is signed in: never his save.
	await act(async () => answers[0].resolve(bundle));
	expect(result.current).toEqual({ state: "loading" });
	expect(findSudokuSaveBySession(SESSION)).toBeNull();
	// Bob's own question gets the owner-only answer.
	await act(async () => answers[1].resolve(null));
	expect(result.current).toEqual({ state: "missing" });
	expect(findSudokuSaveBySession(SESSION)).toBeNull();
});

it("opens the account's newer board once the sync replaces the phone's copy", async () => {
	const { result } = await renderHook(() => useOpenedSave(SESSION));
	await waitFor(() => expect(answers).toHaveLength(1));
	await act(async () => answers[0].resolve(bundle));
	const opened = result.current;
	if (opened.state !== "ready") throw new Error("Expected a save");

	// The player's own moves and their sync leave the screen's save alone.
	await act(async () => {
		writeSudokuSave({ ...opened.save, elapsedSeconds: 40 });
	});
	expect(result.current).toBe(opened);

	const digits = "3".padEnd(81, "0");
	const newer = {
		...bundle,
		state: { ...bundle.state, digits, updatedAt: 12_000 },
	} as CloudBundle;
	await act(async () => {
		storeSyncedSave(
			saveFromBundle(newer, { id: opened.save.id, userId: ALICE, now: 0 }),
		);
	});
	expect(result.current).toMatchObject({
		state: "ready",
		save: { board: { digits }, cloud: { loadedUpdatedAt: 12_000 } },
	});
});
