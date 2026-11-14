import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { openWebPage } from "./session-links";

jest.mock("expo-web-browser", () => ({
	openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
}));

describe("openWebPage", () => {
	it("opens a web join link in the in-app browser, not through the system", async () => {
		const openURL = jest.spyOn(Linking, "openURL");
		const url = "https://arcade-club.appelent.nl/join?token=abc";
		await openWebPage(url);
		expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(url);
		expect(openURL).not.toHaveBeenCalled();
	});
});
