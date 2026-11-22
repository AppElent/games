import type { CardId } from "@arcadeclub/core/cards/deck";
import {
	createCardGame,
	getCardGame,
	viewCardGame,
} from "@arcadeclub/core/cards/engine";
import type { GinView } from "@arcadeclub/core/cards/gin";
import { messages } from "@arcadeclub/core/messages";
import { screen, within } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { GinTable } from "./gin-table";
import type { CardTableBundle, CardTableControls } from "./use-card-table";

// The animation libraries need their native side; plain stand-ins do here.
jest.mock(
	"react-native-reanimated",
	() => require("../../../../test/reanimated-mock").reanimatedMock,
);
jest.mock(
	"react-native-worklets",
	() => require("../../../../test/reanimated-mock").workletsMock,
);

const inMeld = messages.en.games.cards.gin.inMeld;
const ids = (cards: string) =>
	cards.split(" ").map((card) => `${card}#0` as CardId);

// A run of spades and a set of fives; the rest is deadwood.
const RUN = ids("SA S2 S3");
const SET = ids("H5 D5 C5");
const DEADWOOD = ids("HK C9 D2 CJ");

async function renderGin() {
	const game = getCardGame("gin-rummy");
	const state = createCardGame(game, [], 2);
	const dealt = viewCardGame(game, [], state, 0) as GinView;
	const view: GinView = { ...dealt, hand: [...DEADWOOD, ...SET, ...RUN] };
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
		seats: [0, 1].map(seat),
		session: {
			title: "Table",
			joinCode: "ABCD",
			joinMode: "open",
			locked: false,
		},
	} as unknown as CardTableBundle;
	const controls = {
		act: jest.fn(),
		pending: false,
		error: "",
		setAutopilot: jest.fn(),
	} as unknown as CardTableControls;
	await renderScreen(
		<GinTable game={game} table={table} view={view} controls={controls} />,
	);
}

const badge = (card: CardId) =>
	within(screen.getByTestId(`hand-${card}`)).queryByText(/^\d+$/);
const label = (card: CardId): string =>
	screen.getByTestId(`hand-${card}`).props.accessibilityLabel;

describe("GinTable hand meld badge", () => {
	it("numbers each card in a meld and says the meld to a screen reader", async () => {
		await renderGin();

		const runNumber = badge(RUN[0])?.props.children;
		const setNumber = badge(SET[0])?.props.children;
		expect([runNumber, setNumber].sort()).toEqual([1, 2]);
		for (const [meld, n] of [
			[RUN, runNumber],
			[SET, setNumber],
		] as const) {
			for (const card of meld) {
				expect(badge(card)?.props.children).toBe(n);
				expect(label(card)).toMatch(
					new RegExp(`, ${inMeld.replace("{n}", String(n))}$`),
				);
			}
		}
	});

	it("leaves deadwood without a badge or a meld in its label", async () => {
		await renderGin();

		const meldWord = inMeld.replace("{n}", "");
		for (const card of DEADWOOD) {
			expect(badge(card)).toBeNull();
			expect(label(card)).not.toContain(meldWord);
		}
	});
});
