import { messages } from "@arcadeclub/core/messages";
import { screen } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { useQuery } from "../../../convex/query-cache";
import { CardTableScreen } from "./card-table-screen";

// The animation libraries need their native side; plain stand-ins do here.
jest.mock(
	"react-native-reanimated",
	() => require("../../../../test/reanimated-mock").reanimatedMock,
);
jest.mock(
	"react-native-worklets",
	() => require("../../../../test/reanimated-mock").workletsMock,
);

const words = messages.en.games.cards.session;

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
	return renderScreen(<CardTableScreen sessionId="session-1" />);
}

describe("CardTableScreen", () => {
	it("asks for an update instead of crashing on a game this build does not know", async () => {
		await renderTable("a-card-game-from-a-newer-build");

		expect(screen.getByText(words.updateToPlay)).toBeTruthy();
		expect(screen.getByText(words.updateToPlayHint)).toBeTruthy();
		expect(screen.getByText(words.backToGames)).toBeTruthy();
	});

	it("does not ask for an update on a game it knows", async () => {
		await renderTable("pesten");

		expect(screen.getByText("ABCD")).toBeTruthy(); // the lobby's join code
		expect(screen.queryByText(words.updateToPlay)).toBeNull();
	});
});
