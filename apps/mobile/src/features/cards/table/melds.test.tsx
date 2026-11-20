import { screen } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { Fan } from "./melds";

describe("Fan", () => {
	it("lifts and outlines only the cards that were laid off", async () => {
		await renderScreen(
			<Fan
				cards={["S2#0", "S3#0", "S4#0", "S5#0"]}
				width={34}
				step={19}
				laidOff={["S5#0"]}
			/>,
		);

		expect(screen.getByTestId("laid-off-S5#0")).toBeTruthy();
		expect(screen.queryByTestId("laid-off-S4#0")).toBeNull();
	});

	it("marks nothing without a laid-off list", async () => {
		await renderScreen(<Fan cards={["S2#0", "S3#0"]} width={34} step={19} />);

		expect(screen.queryByTestId("laid-off-S2#0")).toBeNull();
	});
});
