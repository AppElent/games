import {
	createCardGame,
	getCardGame,
	viewCardGame,
} from "@arcadeclub/core/cards/engine";
import type { TricksView } from "@arcadeclub/core/cards/tricks";
import { fireEvent, screen } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { TricksTable } from "./tricks-table";
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

describe("TricksTable passing", () => {
	it("keeps the chosen cards selected when the pass is refused", async () => {
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
		const act = jest.fn();
		const controls = {
			act,
			pending: false,
			error: "",
			setAutopilot: jest.fn(),
		} as unknown as CardTableControls;
		await renderScreen(
			<TricksTable game={game} table={table} view={view} controls={controls} />,
		);

		const chosen = view.hand.slice(0, view.passCount);
		for (const card of chosen) {
			await fireEvent.press(screen.getByTestId(`hand-${card}`));
		}
		const selected = () =>
			chosen.map(
				(card) =>
					screen.getByTestId(`hand-${card}`).props.accessibilityState?.selected,
			);
		expect(selected()).toEqual(chosen.map(() => true));

		await fireEvent.press(screen.getByTestId("cards-pass-cards"));
		expect(act).toHaveBeenCalledWith({ type: "passCards", cards: chosen });
		expect(selected()).toEqual(chosen.map(() => true));
	});
});
