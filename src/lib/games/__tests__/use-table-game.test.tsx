// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readTableSeat, storeTableSeat } from "#/lib/games/table-seat";
import { type TableModule, useTableGame } from "#/lib/games/use-table-game";
import type { Id } from "../../../../convex/_generated/dataModel";

/** The table's getTable answer, the auth state and every mutation call. */
const convex = vi.hoisted(() => ({
	auth: { isLoading: false, isAuthenticated: false },
	calls: [] as { name: string; args: unknown }[],
	answers: {} as Record<string, (args: unknown) => Promise<unknown>>,
}));

vi.mock("convex/react", () => ({
	useConvexAuth: () => convex.auth,
	useQuery: (_query: unknown, args: unknown) =>
		args === "skip" ? undefined : { seats: [], you: null },
	// The module's refs are plain names; `api.sessions.heartbeat` is a proxy.
	useMutation: (ref: unknown) => (args: unknown) => {
		const name = typeof ref === "string" ? ref : "heartbeat";
		convex.calls.push({ name, args });
		return convex.answers[name]?.(args) ?? Promise.resolve(null);
	},
}));

vi.mock("#/lib/games/errors", () => ({
	useErrorMessage: () => () => "error",
}));

const module = {
	getTable: "getTable",
	takeSeat: "takeSeat",
	reclaimSeat: "reclaimSeat",
	act: "act",
	addBot: "addBot",
	removeSeat: "removeSeat",
	start: "start",
	rematch: "rematch",
	setAutopilot: "setAutopilot",
} as unknown as TableModule;

const words = {
	seatError: "seat",
	couldNotChange: "change",
	couldNotStart: "start",
	actionFailed: "action",
};
const sessionId = "session_a" as Id<"gameSessions">;
const alice = "participant_alice" as Id<"sessionParticipants">;
const aliceSeat = {
	participantId: alice,
	seatSecret: "secret-alice-0123456789",
};

const calls = (name: string) =>
	convex.calls.filter((call) => call.name === name);

/** This jsdom has no localStorage; the seat store needs one. */
function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key);
		},
		setItem: (key, value) => {
			items.set(key, value);
		},
	};
}

describe("useTableGame", () => {
	beforeEach(() => {
		const storage = memoryStorage();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			get: () => storage,
		});
	});

	afterEach(() => {
		cleanup();
		convex.auth = { isLoading: false, isAuthenticated: false };
		convex.calls = [];
		convex.answers = {};
	});

	it("takes a signed-in player's seat back on a browser that holds none", async () => {
		convex.auth = { isLoading: false, isAuthenticated: true };
		convex.answers.reclaimSeat = () => Promise.resolve(aliceSeat);
		const { result } = renderHook(() => useTableGame(module, sessionId, words));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(calls("reclaimSeat")).toEqual([
			{ name: "reclaimSeat", args: { sessionId } },
		]);
		expect(readTableSeat(sessionId)).toEqual(aliceSeat);
		result.current.start();
		expect(calls("start").at(-1)?.args).toEqual({ sessionId, ...aliceSeat });
	});

	it("shows the table at once and asks only once sign-in settles", async () => {
		convex.auth = { isLoading: true, isAuthenticated: false };
		const { result, rerender } = renderHook(() =>
			useTableGame(module, sessionId, words),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(calls("reclaimSeat")).toHaveLength(0);
		convex.auth = { isLoading: false, isAuthenticated: true };
		rerender();
		await waitFor(() => expect(calls("reclaimSeat")).toHaveLength(1));
	});

	it("asks again when the stored seat is turned away", async () => {
		convex.auth = { isLoading: false, isAuthenticated: true };
		storeTableSeat(sessionId, {
			participantId: "participant_old" as Id<"sessionParticipants">,
			seatSecret: "secret-old-0123456789",
		});
		convex.answers.takeSeat = (args) =>
			(args as { participantId: string }).participantId === alice
				? Promise.resolve(0)
				: Promise.reject({ data: { code: "cardsSeatCredential" } });
		convex.answers.reclaimSeat = () => Promise.resolve(aliceSeat);
		const { result } = renderHook(() => useTableGame(module, sessionId, words));
		await waitFor(() => expect(readTableSeat(sessionId)).toEqual(aliceSeat));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(calls("reclaimSeat")).toHaveLength(1);
	});

	it("shows no seat error while the account's seat is taken back", async () => {
		convex.auth = { isLoading: false, isAuthenticated: true };
		storeTableSeat(sessionId, {
			participantId: "participant_old" as Id<"sessionParticipants">,
			seatSecret: "secret-old-0123456789",
		});
		convex.answers.takeSeat = (args) =>
			(args as { participantId: string }).participantId === alice
				? Promise.resolve(0)
				: Promise.reject({ data: { code: "cardsSeatCredential" } });
		let giveSeat: (seat: typeof aliceSeat) => void = () => {};
		convex.answers.reclaimSeat = () =>
			new Promise((resolve) => {
				giveSeat = resolve;
			});
		const { result } = renderHook(() => useTableGame(module, sessionId, words));
		await waitFor(() => expect(calls("reclaimSeat")).toHaveLength(1));
		expect(result.current.error).toBe("");
		giveSeat(aliceSeat);
		await waitFor(() => expect(readTableSeat(sessionId)).toEqual(aliceSeat));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBe("");
	});

	it("says the seat was turned away when the account has none either", async () => {
		convex.auth = { isLoading: false, isAuthenticated: true };
		storeTableSeat(sessionId, {
			participantId: "participant_old" as Id<"sessionParticipants">,
			seatSecret: "secret-old-0123456789",
		});
		convex.answers.takeSeat = () =>
			Promise.reject({ data: { code: "cardsSeatCredential" } });
		const { result } = renderHook(() => useTableGame(module, sessionId, words));
		await waitFor(() => expect(result.current.error).toBe(words.seatError));
		expect(readTableSeat(sessionId)).toBeNull();
	});

	it("asks the new account for its seat when another account signs in", async () => {
		convex.auth = { isLoading: false, isAuthenticated: true };
		convex.answers.reclaimSeat = () => Promise.resolve(aliceSeat);
		const { result, rerender } = renderHook(() =>
			useTableGame(module, sessionId, words),
		);
		await waitFor(() => expect(readTableSeat(sessionId)).toEqual(aliceSeat));
		expect(calls("reclaimSeat")).toHaveLength(1);

		// Another account signs in on the same open page: Convex drops the old
		// sign-in before it confirms the new one.
		const bob = {
			participantId: "participant_bob" as Id<"sessionParticipants">,
			seatSecret: "secret-bob-0123456789",
		};
		convex.answers.reclaimSeat = () => Promise.resolve(bob);
		convex.auth = { isLoading: false, isAuthenticated: false };
		rerender();
		convex.auth = { isLoading: false, isAuthenticated: true };
		rerender();
		await waitFor(() => expect(readTableSeat(sessionId)).toEqual(bob));
		expect(calls("reclaimSeat")).toHaveLength(2);
		await waitFor(() => expect(result.current.loading).toBe(false));
		result.current.start();
		expect(calls("start").at(-1)?.args).toEqual({ sessionId, ...bob });
	});

	it("never asks for a guest, who keeps only the seat this browser holds", async () => {
		const { result } = renderHook(() => useTableGame(module, sessionId, words));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(calls("reclaimSeat")).toHaveLength(0);
		expect(readTableSeat(sessionId)).toBeNull();
	});

	it("leaves a signed-in player without a seat watching", async () => {
		convex.auth = { isLoading: false, isAuthenticated: true };
		const { result } = renderHook(() => useTableGame(module, sessionId, words));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(calls("reclaimSeat")).toHaveLength(1);
		expect(readTableSeat(sessionId)).toBeNull();
	});
});
