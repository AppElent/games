import { ACCOUNT_PORTAL_URL } from "@arcadeclub/core/account-portal";
import { messages } from "@arcadeclub/core/messages";
import { fireEvent, screen } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import { renderScreen } from "../../../../test/render-screen";
import { ProfileScreen } from "./profile-screen";

jest.mock("@clerk/expo", () => ({
	useAuth: () => ({
		isLoaded: true,
		isSignedIn: true,
		getToken: jest.fn(),
		signOut: jest.fn(),
	}),
	useUser: () => ({
		isLoaded: true,
		isSignedIn: true,
		user: {
			passwordEnabled: true,
			firstName: "Ada",
			lastName: "Player",
			primaryEmailAddress: { emailAddress: "player+clerk_test@example.com" },
		},
	}),
}));

jest.mock("../../../env", () => ({
	env: {
		...jest.requireActual("../../../env").env,
		webOrigin: "https://arcade.example/",
	},
}));

jest.mock("expo-web-browser", () => ({
	openBrowserAsync: jest.fn(() => Promise.resolve({ type: "opened" })),
}));

describe("ProfileScreen account portal row", () => {
	beforeEach(() => {
		jest.mocked(WebBrowser.openBrowserAsync).mockClear();
	});

	it.each(["en", "nl"] as const)(
		"shows the %s label and opens the AppElent account portal",
		async (locale) => {
			await renderScreen(<ProfileScreen />);
			// Switch language with the screen's own control, as a player would.
			await fireEvent.press(
				screen.getByText(messages.en.profile.languages[locale]),
			);

			const row = await screen.findByTestId("profile-account-portal");
			expect(
				screen.getByLabelText(messages[locale].profile.accountPortal.action),
			).toBe(row);

			await fireEvent.press(row);
			expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
			expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
				ACCOUNT_PORTAL_URL,
			);
			expect(ACCOUNT_PORTAL_URL).toBe("https://account.appelent.nl");
		},
	);

	it.each(["en", "nl"] as const)(
		"says so when the portal cannot be opened (%s)",
		async (locale) => {
			jest
				.mocked(WebBrowser.openBrowserAsync)
				.mockRejectedValueOnce(new Error("No matching browser"));
			await renderScreen(<ProfileScreen />);
			await fireEvent.press(
				screen.getByText(messages.en.profile.languages[locale]),
			);

			const { failed } = messages[locale].profile.accountPortal;
			expect(screen.queryByText(failed)).toBeNull();
			await fireEvent.press(screen.getByTestId("profile-account-portal"));
			expect(await screen.findByText(failed)).toBeTruthy();

			// A retry that opens clears the message.
			await fireEvent.press(screen.getByTestId("profile-account-portal"));
			expect(screen.queryByText(failed)).toBeNull();
		},
	);
});

describe("ProfileScreen privacy policy row", () => {
	beforeEach(() => {
		jest.mocked(WebBrowser.openBrowserAsync).mockClear();
	});

	it("opens the web app's privacy page and says it leaves the app", async () => {
		await renderScreen(<ProfileScreen />);
		await fireEvent.press(screen.getByText(messages.en.profile.languages.en));

		const row = await screen.findByTestId("profile-privacy-policy");
		expect(row.props.accessibilityHint).toBe(
			messages.en.profile.opensInBrowser,
		);
		await fireEvent.press(row);
		expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(
			"https://arcade.example/privacy",
		);
		expect(screen.queryByText(messages.en.profile.privacyFailed)).toBeNull();
	});

	it.each(["en", "nl"] as const)(
		"says so when the privacy policy cannot be opened (%s)",
		async (locale) => {
			jest
				.mocked(WebBrowser.openBrowserAsync)
				.mockRejectedValueOnce(new Error("No matching browser"));
			await renderScreen(<ProfileScreen />);
			await fireEvent.press(
				screen.getByText(messages.en.profile.languages[locale]),
			);

			const failed = messages[locale].profile.privacyFailed;
			await fireEvent.press(screen.getByTestId("profile-privacy-policy"));
			expect(await screen.findByText(failed)).toBeTruthy();
			// The account portal row keeps its own message.
			expect(
				screen.queryByText(messages[locale].profile.accountPortal.failed),
			).toBeNull();

			// A retry that opens clears the message.
			await fireEvent.press(screen.getByTestId("profile-privacy-policy"));
			expect(screen.queryByText(failed)).toBeNull();
		},
	);
});
