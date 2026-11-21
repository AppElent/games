import { messages } from "@arcadeclub/core/messages";
import { screen } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { useQuery } from "../../../convex/query-cache";
import { DiceTableScreen } from "./dice-table-screen";

const words = messages.en.games.dice.session;

/** The shape `getTable` returns, with no seats filled. */
function tableOf(gameId: string) {
	return {
		session: {
			title: "Table",
			joinCode: "ABCD",
			joinMode: "open",
			locked: false,
		},
		gameId,
		options: [],
		status: "lobby",
		seats: [],
		you: null,
		isHost: false,
		view: null,
	};
}

function renderTable(gameId: string) {
	jest.mocked(useQuery).mockReturnValue(tableOf(gameId));
	return renderScreen(<DiceTableScreen sessionId="session-1" />);
}

describe("DiceTableScreen", () => {
	it("asks for an update instead of crashing on a game this build does not know", async () => {
		await renderTable("a-dice-game-from-a-newer-build");

		expect(screen.getByText(words.updateToPlay)).toBeTruthy();
		expect(screen.getByText(words.updateToPlayHint)).toBeTruthy();
		expect(screen.getByText(words.backToGames)).toBeTruthy();
	});

	it("does not ask for an update on a game it knows", async () => {
		await renderTable("yatzy");

		expect(screen.getByText("ABCD")).toBeTruthy(); // the lobby's join code
		expect(screen.queryByText(words.updateToPlay)).toBeNull();
	});
});
