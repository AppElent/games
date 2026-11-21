import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useConvexAuth, useMutation } from "convex/react";
import type { ReactNode } from "react";
import type { Id } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";
import { LocaleProvider } from "../../i18n";
import { findSeat, forgetSeat, rememberSeat } from "../sessions/session-seats";
import { type TableModule, useTableGame } from "./use-table-game";

// The shared mock gives plain functions; this test steers sign-in and mutations.
jest.mock("convex/react", () => ({
	...jest.requireActual("convex/react"),
	useConvexAuth: jest.fn(),
	useMutation: jest.fn(),
}));

const sessionId = "session_a" as Id<"gameSessions">;
const alice = {
	participantId: "participant_alice" as Id<"sessionParticipants">,
	seatSecret: "secret-alice-0123456789",
};
const bob = {
	participantId: "participant_bob" as Id<"sessionParticipants">,
	seatSecret: "secret-bob-0123456789",
};
const old = {
	participantId: "participant_old" as Id<"sessionParticipants">,
	seatSecret: "secret-old-0123456789",
};

// The module's refs are plain names; `api.sessions.heartbeat` is a proxy.
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

const wrapper = ({ children }: { children: ReactNode }) => (
	<LocaleProvider>{children}</LocaleProvider>
);

let auth = { isLoading: false, isAuthenticated: false };
let calls: { name: string; args: unknown }[] = [];
let answers: Record<string, (args: unknown) => Promise<unknown>> = {};
const mutations = new Map<string, (args: unknown) => Promise<unknown>>();

const called = (name: string) => calls.filter((call) => call.name === name);

async function setup() {
	return renderHook(
		() => useTableGame(module, "card-games", sessionId, words),
		{
			wrapper,
		},
	);
}

beforeEach(() => {
	auth = { isLoading: false, isAuthenticated: false };
	calls = [];
	answers = {};
	mutations.clear();
	forgetSeat(sessionId);
	jest
		.mocked(useConvexAuth)
		.mockImplementation(() => ({ isRefreshing: false, ...auth }));
	jest.mocked(useQuery).mockReturnValue({ seats: [], you: null });
	// One function per mutation, as the real hook gives: effects depend on it.
	jest.mocked(useMutation).mockImplementation(((ref: unknown) => {
		const name = typeof ref === "string" ? ref : "heartbeat";
		let mutation = mutations.get(name);
		if (!mutation) {
			mutation = (args) => {
				calls.push({ name, args });
				return answers[name]?.(args) ?? Promise.resolve(null);
			};
			mutations.set(name, mutation);
		}
		return mutation;
	}) as unknown as typeof useMutation);
});

describe("mobile useTableGame seat reclaim", () => {
	it("takes a signed-in player's seat back on a phone that holds none", async () => {
		auth = { isLoading: false, isAuthenticated: true };
		answers.reclaimSeat = () => Promise.resolve(alice);
		const { result } = await setup();
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(called("reclaimSeat")).toEqual([
			{ name: "reclaimSeat", args: { sessionId } },
		]);
		expect(findSeat(sessionId)).toMatchObject({
			...alice,
			gameType: "card-games",
		});
		await act(async () => result.current.start());
		expect(called("start").at(-1)?.args).toEqual({ sessionId, ...alice });
	});

	it("shows the table at once and asks only once sign-in settles", async () => {
		auth = { isLoading: true, isAuthenticated: false };
		const { result, rerender } = await setup();
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(called("reclaimSeat")).toHaveLength(0);
		auth = { isLoading: false, isAuthenticated: true };
		await act(async () => rerender({}));
		await waitFor(() => expect(called("reclaimSeat")).toHaveLength(1));
	});

	it("never asks for a guest", async () => {
		const { result } = await setup();
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(called("reclaimSeat")).toHaveLength(0);
		expect(findSeat(sessionId)).toBeUndefined();
	});

	it("shows no seat error while the account's seat is taken back", async () => {
		auth = { isLoading: false, isAuthenticated: true };
		rememberSeat({ sessionId, gameType: "card-games", ...old });
		answers.takeSeat = (args) =>
			(args as { participantId: string }).participantId === alice.participantId
				? Promise.resolve(0)
				: Promise.reject({ data: { code: "cardsSeatCredential" } });
		let giveSeat: (seat: typeof alice) => void = () => {};
		answers.reclaimSeat = () =>
			new Promise((resolve) => {
				giveSeat = resolve;
			});
		const { result } = await setup();
		await waitFor(() => expect(called("reclaimSeat")).toHaveLength(1));
		expect(result.current.error).toBe("");
		await act(async () => giveSeat(alice));
		await waitFor(() =>
			expect(findSeat(sessionId)?.seatSecret).toBe(alice.seatSecret),
		);
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBe("");
	});

	it("says the seat was turned away when the account has none either", async () => {
		auth = { isLoading: false, isAuthenticated: true };
		rememberSeat({ sessionId, gameType: "card-games", ...old });
		answers.takeSeat = () =>
			Promise.reject({ data: { code: "cardsSeatCredential" } });
		const { result } = await setup();
		await waitFor(() => expect(result.current.error).toBe(words.seatError));
		expect(findSeat(sessionId)).toBeUndefined();
	});

	it("asks the new account for its seat when another account signs in", async () => {
		auth = { isLoading: false, isAuthenticated: true };
		answers.reclaimSeat = () => Promise.resolve(alice);
		const { result, rerender } = await setup();
		await waitFor(() =>
			expect(findSeat(sessionId)?.seatSecret).toBe(alice.seatSecret),
		);
		expect(called("reclaimSeat")).toHaveLength(1);

		// Convex drops the old sign-in before it confirms the new one.
		answers.reclaimSeat = () => Promise.resolve(bob);
		auth = { isLoading: false, isAuthenticated: false };
		await act(async () => rerender({}));
		auth = { isLoading: false, isAuthenticated: true };
		await act(async () => rerender({}));
		await waitFor(() =>
			expect(findSeat(sessionId)?.seatSecret).toBe(bob.seatSecret),
		);
		expect(called("reclaimSeat")).toHaveLength(2);
		await waitFor(() => expect(result.current.loading).toBe(false));
		await act(async () => result.current.start());
		expect(called("start").at(-1)?.args).toEqual({ sessionId, ...bob });
	});
});
