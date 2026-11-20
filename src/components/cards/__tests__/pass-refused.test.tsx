// @vitest-environment jsdom
import {
	createCardGame,
	getCardGame,
	viewCardGame,
} from "@arcadeclub/core/cards/engine";
import type { TricksView } from "@arcadeclub/core/cards/tricks";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { TricksTable } from "../TricksTable";
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
	window.matchMedia ??= ((query: string) => ({
		matches: false,
		media: query,
		addEventListener() {},
		removeEventListener() {},
	})) as typeof window.matchMedia;
});

describe("TricksTable passing", () => {
	afterEach(cleanup);

	it("keeps the chosen cards selected when the pass is refused", () => {
		const game = getCardGame("hartenjagen");
		const state = createCardGame(game, [], 4);
		const view = viewCardGame(game, [], state, 0) as TricksView;
		expect(view.phase).toBe("passing");
		const seat = (index: number) => ({
			botIndex: index === 0 ? null : index,
			name: index === 0 ? "Me" : null,
			autopilot: false,
			lastSeen: null,
		});
		const table = {
			you: 0,
			isHost: true,
			status: "playing",
			options: [],
			seats: [0, 1, 2, 3].map(seat),
			session: {
				title: "Table",
				joinCode: "ABCD",
				joinMode: "open",
				locked: false,
			},
		} as unknown as CardTableBundle;
		// The server refuses: the view stays in the passing phase.
		const act = vi.fn();
		const controls = {
			act,
			pending: false,
			error: "",
			setAutopilot: vi.fn(),
		} as unknown as CardTableControls;
		render(
			<LocaleProvider initialLocale="en">
				<TricksTable
					game={game}
					table={table}
					view={view}
					controls={controls}
				/>
			</LocaleProvider>,
		);

		const hand = screen
			.getAllByRole("button")
			.filter((button) => button.hasAttribute("data-card-id"));
		const chosen = hand.slice(0, view.passCount);
		for (const card of chosen) {
			fireEvent.click(card);
		}
		const pressed = () =>
			chosen.map((card) => card.getAttribute("aria-pressed"));
		expect(pressed()).toEqual(chosen.map(() => "true"));

		fireEvent.click(screen.getByRole("button", { name: "Pass these cards" }));
		expect(act).toHaveBeenCalledWith({
			type: "passCards",
			cards: chosen.map((card) => card.getAttribute("data-card-id")),
		});
		expect(pressed()).toEqual(chosen.map(() => "true"));
	});
});
