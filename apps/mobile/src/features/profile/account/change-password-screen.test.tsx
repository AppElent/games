import { messages } from "@arcadeclub/core/messages";
import { useUser } from "@clerk/expo";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { renderScreen } from "../../../../test/render-screen";
import { ChangePasswordScreen } from "./change-password-screen";

const copy = messages.en.profile.password;
const updatePassword = jest.fn();

function signIn(passwordEnabled: boolean) {
	jest.mocked(useUser).mockReturnValue({
		isLoaded: true,
		isSignedIn: true,
		user: {
			passwordEnabled,
			primaryEmailAddress: { emailAddress: "player+clerk_test@example.com" },
			updatePassword,
		},
	} as unknown as ReturnType<typeof useUser>);
}

describe("ChangePasswordScreen", () => {
	beforeEach(() => {
		updatePassword.mockReset();
		jest.spyOn(Alert, "alert").mockImplementation(() => {});
	});

	it("signs the account's other sessions out with the change", async () => {
		signIn(true);
		updatePassword.mockResolvedValue({});
		await renderScreen(<ChangePasswordScreen />);

		await fireEvent.changeText(
			screen.getByTestId("change-password-current"),
			"old",
		);
		await fireEvent.changeText(
			screen.getByTestId("change-password-new"),
			"new-one",
		);
		await fireEvent.press(screen.getByTestId("change-password-submit"));

		await waitFor(() =>
			expect(updatePassword).toHaveBeenCalledWith({
				currentPassword: "old",
				newPassword: "new-one",
				signOutOfOtherSessions: true,
			}),
		);
		await waitFor(() =>
			expect(Alert.alert).toHaveBeenCalledWith(copy.changed, copy.changedBody),
		);
	});

	it("explains instead of asking for a password the account does not have", async () => {
		signIn(false);
		await renderScreen(<ChangePasswordScreen />);

		expect(screen.getByText(copy.none)).toBeTruthy();
		expect(screen.queryByTestId("change-password-current")).toBeNull();
	});
});
