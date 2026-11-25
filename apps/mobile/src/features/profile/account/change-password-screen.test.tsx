import { messages } from "@arcadeclub/core/messages";
import { useAuth, useClerk, useUser } from "@clerk/expo";
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
jest.mock("@clerk/expo", () => ({
	useAuth: jest.fn(),
	useClerk: jest.fn(),
	useUser: jest.fn(),
}));

const startVerification = jest.fn();
const attemptFirst = jest.fn();
const attemptSecond = jest.fn();
let clerk: { user: { id: string }; session: { id: string } };

function signIn(passwordEnabled: boolean) {
	const user = {
		id: "user_1",
		passwordEnabled,
		primaryEmailAddress: { emailAddress: "player+clerk_test@example.com" },
		updatePassword,
	};
	jest.mocked(useUser).mockReturnValue({
		isLoaded: true,
		isSignedIn: true,
		user,
	} as unknown as ReturnType<typeof useUser>);
	clerk = {
		user: { ...user },
		session: {
			id: "sess_1",
			startVerification,
			attemptFirstFactorVerification: attemptFirst,
			attemptSecondFactorVerification: attemptSecond,
		} as never,
	};
	jest.mocked(useClerk).mockReturnValue(clerk as never);
}

describe("ChangePasswordScreen", () => {
	beforeEach(() => {
		for (const mock of [
			updatePassword,
			signOut,
			mockPush,
			mockDismissTo,
			startVerification,
			attemptFirst,
			attemptSecond,
		]) {
			mock.mockReset();
		}
		signOut.mockResolvedValue(undefined);
		jest
			.mocked(useAuth)
			.mockReturnValue({ signOut } as unknown as ReturnType<typeof useAuth>);
		takeReturnTarget("user_1");
		jest
			.spyOn(Alert, "alert")
			.mockReset()
			.mockImplementation(() => {});
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
		const reverifyCopy = messages.en.profile.reverify;
		const refusal = { errors: [{ code: "session_reverification_required" }] };

		async function submitChange() {
			signIn(true);
			updatePassword.mockRejectedValueOnce(refusal).mockResolvedValue({});
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
		}

		const offer = (status: string, first: string[], second: string[] = []) =>
			startVerification.mockResolvedValue({
				status,
				supportedFirstFactors: first.map((strategy) => ({ strategy })),
				supportedSecondFactors: second.map((strategy) => ({ strategy })),
			});

		async function confirmPassword() {
			await fireEvent.changeText(
				await screen.findByTestId("reverify-password"),
				"old",
			);
			await fireEvent.press(
				screen.getByLabelText(reverifyCopy.changePassword.submit),
			);
		}

		it("confirms in the sheet and retries the change once", async () => {
			offer("needs_first_factor", ["password"]);
			attemptFirst.mockResolvedValue({ status: "complete" });
			await submitChange();
			await confirmPassword();
			await waitFor(() =>
				expect(Alert.alert).toHaveBeenCalledWith(
					copy.changed,
					copy.changedBody,
				),
			);
			expect(updatePassword).toHaveBeenCalledTimes(2);
			expect(updatePassword).toHaveBeenLastCalledWith({
				currentPassword: "old",
				newPassword: "new-one",
				signOutOfOtherSessions: true,
			});
			expect(signOut).not.toHaveBeenCalled();
		});

		it("confirms with an authenticator code", async () => {
			offer("needs_second_factor", [], ["totp", "backup_code"]);
			attemptSecond.mockResolvedValue({ status: "complete" });
			await submitChange();
			await fireEvent.changeText(
				await screen.findByTestId("second-factor-code"),
				"123456",
			);
			await fireEvent.press(screen.getByTestId("second-factor-submit"));
			await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
			expect(updatePassword).toHaveBeenCalledTimes(2);
		});

		it("changes nothing and shows no error when cancelled", async () => {
			offer("needs_first_factor", ["password"]);
			await submitChange();
			await screen.findByTestId("reverify-password");
			await fireEvent.press(screen.getByTestId("reverify-cancel"));
			await waitFor(() =>
				expect(screen.queryByText(reverifyCopy.title)).toBeNull(),
			);
			expect(updatePassword).toHaveBeenCalledTimes(1);
			expect(Alert.alert).not.toHaveBeenCalled();
			expect(
				screen.queryByText(messages.en.auth.errors.signInAgain),
			).toBeNull();
		});

		it("doesn't loop when Clerk refuses the retry too", async () => {
			offer("needs_first_factor", ["password"]);
			attemptFirst.mockResolvedValue({ status: "complete" });
			await submitChange();
			updatePassword.mockRejectedValueOnce(refusal);
			await confirmPassword();
			expect(
				await screen.findByText(messages.en.auth.errors.signInAgain),
			).toBeTruthy();
			expect(updatePassword).toHaveBeenCalledTimes(2);
			expect(startVerification).toHaveBeenCalledTimes(1);
		});

		it.each(["user", "session"] as const)(
			"never changes the password of another %s",
			async (part) => {
				offer("needs_first_factor", ["password"]);
				attemptFirst.mockImplementation(async () => {
					clerk[part].id = "other";
					return { status: "complete" };
				});
				await submitChange();
				await confirmPassword();
				expect(await screen.findByText(copy.failed)).toBeTruthy();
				expect(updatePassword).toHaveBeenCalledTimes(1);
			},
		);

		it("closes the sheet and offers signing in again when the session ended", async () => {
			offer("needs_first_factor", ["password"]);
			attemptFirst.mockRejectedValue({
				errors: [{ code: "session_not_found" }],
			});
			await submitChange();
			await confirmPassword();
			expect(await screen.findByLabelText(copy.signInAgain)).toBeTruthy();
			expect(screen.queryByText(reverifyCopy.title)).toBeNull();
		});

		it("offers no sign-in that an unsupported second factor can't finish", async () => {
			offer("needs_second_factor", [], ["passkey"]);
			await submitChange();
			expect(
				await screen.findByText(
					messages.en.serverErrors.accountSecondFactorUnsupported,
				),
			).toBeTruthy();
			expect(screen.queryByLabelText(copy.signInAgain)).toBeNull();
		});

		async function pressSignInAgain() {
			offer("needs_first_factor", ["passkey"]);
			await submitChange();
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
