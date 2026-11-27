// @vitest-environment jsdom
import { sudoku as copy } from "@arcadeclub/core/i18n/en/games/sudoku";
import { describeHint, type SudokuHint } from "@arcadeclub/core/sudoku-hints";
import {
	DEFAULT_SUDOKU_INPUT_SETTINGS,
	type SudokuInputSettings,
} from "@arcadeclub/core/sudoku-input";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import type { Id } from "../../../../convex/_generated/dataModel";

// What the next Hint press finds; null when no technique applies.
const found = vi.hoisted(() => ({ hint: null as SudokuHint | null }));
vi.mock("@arcadeclub/core/sudoku-hints", async (importOriginal) => ({
	...(await importOriginal<typeof import("@arcadeclub/core/sudoku-hints")>()),
	findHint: () => found.hint,
}));
vi.mock("convex/react", () => ({
	useMutation: () => () => Promise.resolve(null),
}));
vi.mock("@tanstack/react-router", () => ({ Link: () => null }));

import { SoloPuzzle } from "../SoloPuzzle";
import type { PuzzleStateDoc } from "../useSoloPuzzleSession";

const SETTINGS_KEY = "arcade-club.sudoku.input-settings";

const single: SudokuHint = {
	technique: "naked-single",
	level: "beginner",
	cells: [0],
	candidateDigits: [5],
	eliminations: [],
	placements: [{ cell: 0, digit: 5 }],
};
const mistake: SudokuHint = { ...single, technique: "mistake" };
const xWing: SudokuHint = {
	technique: "x-wing",
	level: "advanced",
	cells: [0, 8, 72, 80],
	candidateDigits: [3],
	eliminations: [{ cell: 4, digits: [3] }],
	placements: [],
	baseLines: [
		{ kind: "row", index: 0 },
		{ kind: "row", index: 8 },
	],
	coverLines: [
		{ kind: "column", index: 0 },
		{ kind: "column", index: 8 },
	],
	aboveMaxLevel: true,
};

function classic(): PuzzleStateDoc {
	const masks = new Array(81).fill(0);
	return {
		sessionId: "session_1",
		source: "generated",
		status: "active",
		givens: "0".repeat(81),
		digits: "0".repeat(81),
		cornerNotes: masks,
		centerNotes: masks,
		colors: masks,
		autoCleanup: false,
		elapsedSeconds: 0,
		createdAt: 1,
		updatedAt: 1,
	} as unknown as PuzzleStateDoc;
}

function play(settings: Partial<SudokuInputSettings> = {}) {
	localStorage.setItem(
		SETTINGS_KEY,
		JSON.stringify({ ...DEFAULT_SUDOKU_INPUT_SETTINGS, ...settings }),
	);
	render(
		<LocaleProvider initialLocale="en">
			<SoloPuzzle
				sessionId={"session_1" as Id<"gameSessions">}
				title="Puzzle"
				state={classic()}
			/>
		</LocaleProvider>,
	);
}

const pressHint = () =>
	fireEvent.click(screen.getByRole("button", { name: copy.keypad.hint }));
const liveRegion = () => {
	const region = document.querySelector('[aria-live="polite"]');
	if (!region) throw new Error("no live region");
	return region as HTMLElement;
};

const card = () => within(liveRegion());

describe("Sudoku hint card", () => {
	beforeEach(() => {
		found.hint = null;
		localStorage.clear();
	});
	afterEach(cleanup);

	it("says so when no step is found, and dismisses", () => {
		play();
		pressHint();
		expect(card().getByText(copy.game.noHint)).toBeTruthy();
		expect(card().getByText(copy.game.hintFallbackTitle)).toBeTruthy();
		expect(
			card().queryByRole("button", { name: copy.game.tellMeMore }),
		).toBeNull();
		fireEvent.click(
			card().getByRole("button", { name: copy.game.dismissHint }),
		);
		expect(card().queryByText(copy.game.noHint)).toBeNull();
	});

	it("puts the card in a polite live region that is there before the hint", () => {
		play();
		const region = liveRegion();
		expect(region.textContent).toBe("");
		found.hint = single;
		pressHint();
		expect(liveRegion()).toBe(region);
		expect(region.textContent).toContain(
			describeHint(single, 1, copy.hints).text,
		);
	});

	it("shows the level badge", () => {
		play();
		found.hint = single;
		pressHint();
		expect(
			card().getByText(copy.inputSettings.hintLevels.beginner),
		).toBeTruthy();
	});

	it("hides the badge for a mistake", () => {
		play();
		found.hint = mistake;
		pressHint();
		expect(
			card().getByText(describeHint(mistake, 1, copy.hints).text),
		).toBeTruthy();
		expect(
			card().queryByText(copy.inputSettings.hintLevels.beginner),
		).toBeNull();
	});

	it("hides the badge when the level setting is off", () => {
		play({ showHintLevel: false });
		found.hint = single;
		pressHint();
		expect(
			card().getByText(describeHint(single, 1, copy.hints).text),
		).toBeTruthy();
		expect(
			card().queryByText(copy.inputSettings.hintLevels.beginner),
		).toBeNull();
	});

	it("offers a step above the maximum, and shows it anyway on request", () => {
		play({ hintsUpTo: "intermediate" });
		found.hint = xWing;
		pressHint();
		expect(
			card().getByText(
				"The next step needs an advanced technique. Your hints go up to intermediate.",
			),
		).toBeTruthy();
		expect(
			card().queryByRole("button", { name: copy.game.tellMeMore }),
		).toBeNull();

		fireEvent.click(
			card().getByRole("button", { name: copy.game.showHintAnyway }),
		);
		expect(
			card().getByText(describeHint(xWing, 1, copy.hints).text),
		).toBeTruthy();
		expect(
			card().queryByRole("button", { name: copy.game.showHintAnyway }),
		).toBeNull();
		expect(
			card().getByRole("button", { name: copy.game.tellMeMore }),
		).toBeTruthy();
	});
});
