// @vitest-environment jsdom
import {
	createCardGame,
	getCardGame,
	viewCardGame,
} from "@arcadeclub/core/cards/engine";
import type { GinHandResult, GinView } from "@arcadeclub/core/cards/gin";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { GinTable } from "../GinTable";
import type { CardTableBundle, CardTableControls } from "../useCardTable";

vi.mock("@tanstack/react-router", async (original) => ({
	...(await original<typeof import("@tanstack/react-router")>()),
	Link: ({ children }: { children: React.ReactNode }) => (
		<a href="/">{children}</a>
	),
}));

beforeAll(() => {
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
	// jsdom has no modal dialogs; the result sheet opens one.
	HTMLDialogElement.prototype.showModal = function showModal() {
		this.setAttribute("open", "");
	};
	HTMLDialogElement.prototype.close = function close() {
		this.removeAttribute("open");
	};
	window.matchMedia ??= ((query: string) => ({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
	})) as typeof window.matchMedia;
});

const game = getCardGame("gin-rummy");
const table = {
	you: 0,
	isHost: true,
	status: "playing",
	options: [],
	seats: [0, 1].map((index) => ({
		botIndex: index === 0 ? null : index,
		name: index === 0 ? "Me" : null,
		autopilot: false,
		lastSeen: null,
	})),
	session: {
		title: "Table",
		joinCode: "ABCD",
		joinMode: "open",
		locked: false,
	},
} as unknown as CardTableBundle;
const controls = {
	act: vi.fn(),
	pending: false,
	error: "",
	setAutopilot: vi.fn(),
} as unknown as CardTableControls;

function baseView(): GinView {
	const state = createCardGame(game, [], 2);
	return viewCardGame(game, [], state, 0) as GinView;
}

function renderTable(view: GinView) {
	render(
		<LocaleProvider initialLocale="en">
			<GinTable game={game} table={table} view={view} controls={controls} />
		</LocaleProvider>,
	);
}

describe("GinTable meld markers", () => {
	afterEach(cleanup);

	it("numbers the cards of each meld in the hand and leaves deadwood plain", () => {
		const view: GinView = {
			...baseView(),
			phase: "play",
			turn: 0,
			// A run of spades, a set of fives, and two loose cards.
			hand: ["SA#0", "S2#0", "S3#0", "H5#0", "D5#0", "C5#0", "HK#0", "C9#0"],
		};
		renderTable(view);
		const hand = screen
			.getAllByRole("button")
			.filter((button) => button.hasAttribute("data-card-id"));
		const meldOf = (id: string) =>
			hand
				.find((button) => button.getAttribute("data-card-id") === id)
				?.getAttribute("data-meld");
		const run = meldOf("S2#0");
		const set = meldOf("D5#0");
		expect([run, set].sort()).toEqual(["1", "2"]);
		expect(meldOf("SA#0")).toBe(run);
		expect(meldOf("C5#0")).toBe(set);
		expect(meldOf("HK#0")).toBeNull();
		expect(meldOf("C9#0")).toBeNull();
		expect(
			screen.getByRole("button", { name: `two of spades, meld ${run}` }),
		).toBeTruthy();
	});

	it("marks the cards laid off on the knocker's melds in the hand result", () => {
		const result: GinHandResult = {
			kind: "knock",
			knocker: 1,
			winner: 1,
			points: 4,
			deadwood: [6, 2],
			shown: [
				{ melds: [], deadwood: ["C9#0"] },
				{ melds: [["S2#0", "S3#0", "S4#0", "S5#0"]], deadwood: ["C2#0"] },
			],
			laidOff: ["S5#0"],
		};
		renderTable({ ...baseView(), phase: "handOver", result, hand: [] });
		const laidOff = document.querySelectorAll(".laid-off");
		expect(laidOff).toHaveLength(1);
		expect(laidOff[0].querySelector("svg")?.getAttribute("aria-label")).toBe(
			"five of spades, laid off",
		);
		expect(screen.getByText(/laid off on .*melds/)).toBeTruthy();
	});
});
