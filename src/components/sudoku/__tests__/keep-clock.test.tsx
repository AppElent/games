// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import type { Id } from "../../../../convex/_generated/dataModel";

const calls = vi.hoisted(() => [] as { name: string; args: unknown }[]);
vi.mock("convex/react", () => ({
	useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
		const name = getFunctionName(ref);
		return (args: unknown) => {
			calls.push({ name, args });
			return Promise.resolve(
				name === "sudoku:saveProgress" ? { saved: true, updatedAt: 2 } : null,
			);
		};
	},
}));

vi.mock("@tanstack/react-router", () => ({ Link: () => null }));

import { SoloPuzzle } from "../SoloPuzzle";
import { KEEP_CLOCK_MS, type PuzzleStateDoc } from "../useSoloPuzzleSession";

const SESSION = "session_1" as Id<"gameSessions">;

function puzzle(status: "active" | "paused") {
	const state = {
		sessionId: SESSION,
		source: "generated",
		status,
		variant: "binary",
		size: 6,
		givens: "0".repeat(36),
		digits: "0".repeat(36),
		cornerNotes: [],
		centerNotes: [],
		colors: [],
		autoCleanup: false,
		elapsedSeconds: 0,
		createdAt: 1,
		updatedAt: 1,
	} as unknown as PuzzleStateDoc;
	return (
		<LocaleProvider initialLocale="en">
			<SoloPuzzle sessionId={SESSION} title="Puzzle" state={state} />
		</LocaleProvider>
	);
}

const kept = () => calls.filter((call) => call.name === "sudoku:keepClock");
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
	vi.useFakeTimers();
	calls.length = 0;
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

it("folds the clock on the server each minute while the puzzle runs, without a board change", async () => {
	render(puzzle("active"));
	await wait(KEEP_CLOCK_MS * 6);
	expect(kept()).toHaveLength(6);
	expect(kept()[0].args).toMatchObject({ sessionId: SESSION });
	expect(calls.some((call) => call.name === "sudoku:saveProgress")).toBe(false);
});

it("stops while paused and starts again on resume", async () => {
	render(puzzle("paused"));
	await wait(KEEP_CLOCK_MS * 3);
	expect(kept()).toHaveLength(0);
	fireEvent.click(screen.getByRole("button", { name: "Resume" }));
	await wait(KEEP_CLOCK_MS);
	expect(kept()).toHaveLength(1);
});
