// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSeatSearch, rememberSeat, useSeat } from "#/lib/games/seat";
import type { Id } from "../../../../convex/_generated/dataModel";

/** What `sessions.ownSeat` answers; undefined while it loads. */
const ownSeat = vi.hoisted(() => ({
	answer: undefined as string | null | undefined,
	args: [] as unknown[],
}));

vi.mock("convex/react", () => ({
	useQuery: (_query: unknown, args: unknown) => {
		ownSeat.args.push(args);
		return args === "skip" ? undefined : ownSeat.answer;
	},
}));

const alice = "participant_alice" as Id<"sessionParticipants">;
const bob = "participant_bob" as Id<"sessionParticipants">;

describe("seat", () => {
	afterEach(() => {
		cleanup();
		window.sessionStorage.clear();
		ownSeat.answer = undefined;
		ownSeat.args = [];
	});

	it("asks the server with the held seat and this browser's guest id", () => {
		rememberSeat("session_a", alice);
		renderHook(() => useSeat("session_a"));
		expect(ownSeat.args.at(-1)).toEqual({
			sessionId: "session_a",
			participantId: alice,
			guestId: expect.any(String),
		});
	});

	it("takes the account's own seat back when the tab holds none", () => {
		ownSeat.answer = alice;
		const { result } = renderHook(() => useSeat("session_a"));
		expect(result.current).toBe(alice);
	});

	it("takes the account's own seat over another account's held one", () => {
		rememberSeat("session_a", bob);
		ownSeat.answer = alice;
		const { result } = renderHook(() => useSeat("session_a"));
		expect(result.current).toBe(alice);
	});

	it("holds a join link's seat from the first render and asks about it", () => {
		rememberSeat("session_a", bob);
		const { result } = renderHook(() => useSeat("session_a", alice));
		expect(ownSeat.args.at(-1)).toMatchObject({ participantId: alice });
		expect(result.current).toBe(alice);
	});

	it("takes the account's seat over another account's join link", () => {
		ownSeat.answer = bob;
		const { result } = renderHook(() => useSeat("session_a", alice));
		expect(result.current).toBe(bob);
	});

	it("holds no remembered seat when link-only, but still asks for the account's", () => {
		rememberSeat("session_a", bob);
		ownSeat.answer = null;
		const guest = renderHook(() =>
			useSeat("session_a", "", { linkOnly: true }),
		);
		expect(guest.result.current).toBeUndefined();
		expect(ownSeat.args.at(-1)).toMatchObject({ participantId: undefined });
		ownSeat.answer = alice;
		const account = renderHook(() =>
			useSeat("session_a", "", { linkOnly: true }),
		);
		expect(account.result.current).toBe(alice);
	});

	it("moves from the held seat to the account's once the answer arrives", () => {
		rememberSeat("session_a", bob);
		const { result, rerender } = renderHook(() => useSeat("session_a"));
		expect(result.current).toBe(bob);
		ownSeat.answer = alice;
		rerender();
		expect(result.current).toBe(alice);
	});

	it("keeps the held seat when the server finds none for the caller", () => {
		rememberSeat("session_a", bob);
		ownSeat.answer = null;
		const { result } = renderHook(() => useSeat("session_a"));
		expect(result.current).toBe(bob);
	});

	it("reads back the seat remembered for that session", () => {
		rememberSeat("session_a", alice);
		const { result } = renderHook(() => useSeat("session_a"));
		expect(result.current).toBe(alice);
	});

	it("keeps a seat per session, so two games do not share one", () => {
		rememberSeat("session_a", alice);
		rememberSeat("session_b", bob);
		expect(renderHook(() => useSeat("session_a")).result.current).toBe(alice);
		expect(renderHook(() => useSeat("session_b")).result.current).toBe(bob);
	});

	it("has no seat for a session this tab never joined", () => {
		rememberSeat("session_a", alice);
		const { result } = renderHook(() => useSeat("session_c"));
		expect(result.current).toBeUndefined();
	});

	it("follows the session id when it changes", () => {
		rememberSeat("session_a", alice);
		rememberSeat("session_b", bob);
		const { result, rerender } = renderHook(
			({ sessionId }) => useSeat(sessionId),
			{ initialProps: { sessionId: "session_a" } },
		);
		expect(result.current).toBe(alice);
		rerender({ sessionId: "session_b" });
		expect(result.current).toBe(bob);
	});

	it("moves a pre-deploy global seat to the session the tab is on, once", () => {
		window.sessionStorage.setItem("arcade-club.participantId", alice);
		expect(renderHook(() => useSeat("session_a")).result.current).toBe(alice);
		expect(
			window.sessionStorage.getItem("arcade-club.participantId"),
		).toBeNull();
		expect(
			renderHook(() => useSeat("session_b")).result.current,
		).toBeUndefined();
		expect(renderHook(() => useSeat("session_a")).result.current).toBe(alice);
	});

	it("prefers the pre-deploy joined seat, the newer of the two", () => {
		window.sessionStorage.setItem("arcade-club.participantId", bob);
		window.sessionStorage.setItem("arcade-club.hostParticipantId", alice);
		expect(renderHook(() => useSeat("session_a")).result.current).toBe(bob);
	});

	it("carries a pre-deploy host-only seat", () => {
		window.sessionStorage.setItem("arcade-club.hostParticipantId", alice);
		expect(renderHook(() => useSeat("session_a")).result.current).toBe(alice);
	});

	it("parses the participant id a join link carries", () => {
		expect(parseSeatSearch({ participantId: alice })).toEqual({
			participantId: alice,
		});
		expect(parseSeatSearch({})).toEqual({ participantId: "" });
		expect(parseSeatSearch({ participantId: 42 })).toEqual({
			participantId: "",
		});
	});
});
