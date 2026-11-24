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

type Answer = { saved: boolean; updatedAt: number };
type Save = {
	args: { digits: string; baseUpdatedAt?: number };
	answer: (answer: Answer) => void;
};

const saves = vi.hoisted(() => [] as Save[]);
const completed = vi.hoisted(() => [] as unknown[]);
vi.mock("convex/react", () => ({
	useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
		const name = getFunctionName(ref);
		return (args: Save["args"]) => {
			if (name === "sudoku:saveProgress") {
				return new Promise<Answer>((answer) => saves.push({ args, answer }));
			}
			if (name === "sudoku:complete") completed.push(args);
			return Promise.resolve(null);
		};
	},
}));

// The completed banner links on; the link itself is not under test.
vi.mock("@tanstack/react-router", () => ({ Link: () => null }));

import { SoloPuzzle } from "../SoloPuzzle";
import type { PuzzleStateDoc } from "../useSoloPuzzleSession";

const SESSION = "session_1" as Id<"gameSessions">;
const SOLVED = "112122112212221121121122212211221211";

function binary(digits: string, updatedAt: number): PuzzleStateDoc {
	return {
		sessionId: SESSION,
		source: "generated",
		status: "active",
		variant: "binary",
		size: 6,
		givens: "0".repeat(36),
		digits,
		cornerNotes: [],
		centerNotes: [],
		colors: [],
		autoCleanup: false,
		elapsedSeconds: 0,
		createdAt: 1,
		updatedAt,
	} as unknown as PuzzleStateDoc;
}

function classic(digits: string, updatedAt: number): PuzzleStateDoc {
	const masks = new Array(81).fill(0);
	return {
		...binary(digits, updatedAt),
		variant: undefined,
		size: undefined,
		givens: "0".repeat(81),
		cornerNotes: masks,
		centerNotes: masks,
		colors: masks,
	};
}

function puzzle(state: PuzzleStateDoc) {
	return (
		<LocaleProvider initialLocale="en">
			<SoloPuzzle sessionId={SESSION} title="Puzzle" state={state} />
		</LocaleProvider>
	);
}

const cell = (column: number) =>
	screen.getByRole("button", {
		name: new RegExp(`^Row 1, column ${column}(,|$)`),
	});
const tap = (column: number) => fireEvent.click(cell(column));
const quiet = () => act(() => vi.advanceTimersByTimeAsync(1300));
const answer = (index: number, value: Answer) =>
	act(async () => saves[index].answer(value));

beforeEach(() => {
	vi.useFakeTimers();
	saves.length = 0;
	completed.length = 0;
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

it("names the loaded version, then the one each save answered", async () => {
	render(puzzle(binary("0".repeat(36), 100)));
	tap(1);
	await quiet();
	expect(saves[0].args.baseUpdatedAt).toBe(100);
	await answer(0, { saved: true, updatedAt: 200 });
	tap(2);
	await quiet();
	expect(saves[1].args.baseUpdatedAt).toBe(200);
});

it("holds a save until the one before it is answered, then sends the latest", async () => {
	render(puzzle(binary("0".repeat(36), 100)));
	tap(1);
	await quiet();
	tap(2);
	await quiet();
	tap(3);
	await quiet();
	expect(saves).toHaveLength(1);
	await answer(0, { saved: true, updatedAt: 200 });
	expect(saves).toHaveLength(2);
	expect(saves[1].args).toMatchObject({
		digits: "111".padEnd(36, "0"),
		baseUpdatedAt: 200,
	});
});

it("takes the stored board when a save is refused, and saves on from there", async () => {
	const { rerender } = render(puzzle(binary("0".repeat(36), 100)));
	tap(1);
	await quiet();
	// Queued and pending moves on the stale board go with it.
	tap(2);
	await quiet();
	tap(3);
	// The subscription shows the phone's board before the refusal settles.
	rerender(puzzle(binary("002".padEnd(36, "0"), 300)));
	await answer(0, { saved: false, updatedAt: 300 });
	expect(cell(1).textContent).toBe("");
	expect(cell(3).textContent).toBe("1");
	await quiet();
	expect(saves).toHaveLength(1);
	tap(1);
	await quiet();
	expect(saves[1].args).toMatchObject({
		digits: "102".padEnd(36, "0"),
		baseUpdatedAt: 300,
	});
});

it("takes the stored board on a classic puzzle too", async () => {
	const { rerender } = render(puzzle(classic("0".repeat(81), 100)));
	tap(1);
	fireEvent.keyDown(window, { key: "4" });
	await quiet();
	expect(saves[0].args).toMatchObject({
		digits: "4".padEnd(81, "0"),
		baseUpdatedAt: 100,
	});
	rerender(puzzle(classic("07".padEnd(81, "0"), 300)));
	await answer(0, { saved: false, updatedAt: 300 });
	expect(cell(1).textContent).toBe("");
	expect(cell(2).textContent).toBe("7");
});

it("keeps a board solved before the refusal came back", async () => {
	render(puzzle(binary(`00${SOLVED.slice(2)}`, 100)));
	tap(1);
	await quiet();
	tap(2);
	await answer(0, { saved: false, updatedAt: 300 });
	expect(completed).toHaveLength(1);
	expect(cell(1).textContent).not.toBe("");
	expect(cell(2).textContent).not.toBe("");
});
