// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseSeatSearch, rememberSeat, useSeat } from "#/lib/games/seat";
import type { Id } from "../../../../convex/_generated/dataModel";

const alice = "participant_alice" as Id<"sessionParticipants">;
const bob = "participant_bob" as Id<"sessionParticipants">;

describe("seat", () => {
	afterEach(() => {
		cleanup();
		window.sessionStorage.clear();
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
