import { messages } from "@arcadeclub/core/messages";
import { useAuth, useUser } from "@clerk/expo";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { renderScreen } from "../../../../test/render-screen";
import { takeReturnTarget } from "../../../auth/return-target";
import { ChangePasswordScreen } from "./change-password-screen";

const copy = messages.en.profile.password;
const updatePassword = jest.fn();
const signOut = jest.fn();
const mockPush = jest.fn();
const mockDismissTo = jest.fn();

jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useRouter: () => ({ push: mockPush, dismissTo: mockDismissTo, back() {} }),
}));
jest.mock("@clerk/expo", () => ({ useAuth: jest.fn(), useUser: jest.fn() }));

function signIn(passwordEnabled: boolean) {
	jest.mocked(useUser).mockReturnValue({
		isLoaded: true,
		isSignedIn: true,
		user: {
			id: "user_1",
			passwordEnabled,
			primaryEmailAddress: { emailAddress: "player+clerk_test@example.com" },
			updatePassword,
		},
	} as unknown as ReturnType<typeof useUser>);
}

describe("ChangePasswordScreen", () => {
	beforeEach(() => {
		for (const mock of [updatePassword, signOut, mockPush, mockDismissTo]) {
			mock.mockReset();
		}
		signOut.mockResolvedValue(undefined);
		jest
			.mocked(useAuth)
			.mockReturnValue({ signOut } as unknown as ReturnType<typeof useAuth>);
		takeReturnTarget("user_1");
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

	describe("when Clerk wants a fresh sign-in", () => {
		async function pressSignInAgain() {
			signIn(true);
			updatePassword.mockRejectedValue({
				errors: [{ code: "session_reverification_required" }],
			});
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
			expect(
				await screen.findByText(messages.en.auth.errors.signInAgain),
			).toBeTruthy();
			await fireEvent.press(screen.getByLabelText(copy.signInAgain));
			await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
		}

		it("signs out, opens the sign-in and comes back to this screen", async () => {
			await pressSignInAgain();
			await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/sign-in"));
			expect(takeReturnTarget("user_1")).toBe("/profile/change-password");
		});

		it("returns nowhere when signing out fails", async () => {
			signOut.mockRejectedValue(new Error("offline"));
			await pressSignInAgain();
			expect(mockPush).not.toHaveBeenCalled();
			expect(takeReturnTarget("user_1")).toBeNull();
		});
	});

	it("explains instead of asking for a password the account does not have", async () => {
		signIn(false);
		await renderScreen(<ChangePasswordScreen />);

		expect(screen.getByText(copy.none)).toBeTruthy();
		expect(screen.queryByTestId("change-password-current")).toBeNull();
	});
});
