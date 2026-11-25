import { messages } from "@arcadeclub/core/messages";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
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

		/** `retry`: what the change does once Clerk has the confirmation. */
		async function submitChange(retry: "ok" | "refused" = "ok") {
			signIn(true);
			updatePassword.mockRejectedValueOnce(refusal);
			if (retry === "refused") updatePassword.mockRejectedValueOnce(refusal);
			else updatePassword.mockResolvedValue({});
			const view = await renderScreen(<ChangePasswordScreen />);
			await fireEvent.changeText(
				screen.getByTestId("change-password-current"),
				"old",
			);
			await fireEvent.changeText(
				screen.getByTestId("change-password-new"),
				"new-one",
			);
			await fireEvent.press(screen.getByTestId("change-password-submit"));
			return view;
		}

		const offer = (status: string, first: string[], second: string[] = []) =>
			startVerification.mockResolvedValue({
				status,
				supportedFirstFactors: first.map((strategy) => ({ strategy })),
				supportedSecondFactors: second.map((strategy) => ({ strategy })),
			});

		/** Types the password into the sheet, when the typed one didn't confirm. */
		async function confirmPassword() {
			await fireEvent.changeText(
				await screen.findByTestId("reverify-password"),
				"old",
			);
			await fireEvent.press(
				screen.getByLabelText(reverifyCopy.changePassword.submit),
			);
		}

		it("confirms with the password it was given and retries the change once", async () => {
			offer("needs_first_factor", ["password"]);
			attemptFirst.mockResolvedValue({ status: "complete" });
			await submitChange();
			await waitFor(() =>
				expect(Alert.alert).toHaveBeenCalledWith(
					copy.changed,
					copy.changedBody,
				),
			);
			// Never asked for the password it had just been given.
			expect(screen.queryByTestId("reverify-password")).toBeNull();
			expect(attemptFirst).toHaveBeenCalledTimes(1);
			expect(attemptFirst).toHaveBeenCalledWith({
				strategy: "password",
				password: "old",
			});
			expect(updatePassword).toHaveBeenCalledTimes(2);
			expect(updatePassword).toHaveBeenLastCalledWith({
				currentPassword: "old",
				newPassword: "new-one",
				signOutOfOtherSessions: true,
			});
			expect(signOut).not.toHaveBeenCalled();
		});

		it("asks in the sheet, with Clerk's reason, when that password doesn't confirm", async () => {
			offer("needs_first_factor", ["password"]);
			attemptFirst
				.mockRejectedValueOnce({
					errors: [{ code: "form_password_incorrect" }],
				})
				.mockResolvedValue({ status: "complete" });
			await submitChange();
			expect(
				await screen.findByText(messages.en.auth.errors.passwordIncorrect),
			).toBeTruthy();
			await confirmPassword();
			await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
			expect(attemptFirst).toHaveBeenCalledTimes(2);
			expect(updatePassword).toHaveBeenCalledTimes(2);
		});

		it("confirms with a code from the authenticator app after the password", async () => {
			offer("needs_first_factor", ["password"], ["totp", "backup_code"]);
			attemptFirst.mockResolvedValue({
				status: "needs_second_factor",
				supportedSecondFactors: [{ strategy: "totp" }],
			});
			attemptSecond.mockResolvedValue({ status: "complete" });
			await submitChange();
			// The password was not asked twice; only the second step is left.
			await fireEvent.changeText(
				await screen.findByTestId("second-factor-code"),
				"123456",
			);
			expect(screen.queryByTestId("reverify-password")).toBeNull();
			await fireEvent.press(screen.getByTestId("second-factor-submit"));
			await waitFor(() =>
				expect(Alert.alert).toHaveBeenCalledWith(
					copy.changed,
					copy.changedBody,
				),
			);
			expect(attemptFirst).toHaveBeenCalledTimes(1);
			expect(attemptSecond).toHaveBeenCalledWith({
				strategy: "totp",
				code: "123456",
			});
			expect(updatePassword).toHaveBeenCalledTimes(2);
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
			await submitChange("refused");
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
				// Said so, not the generic failure: the person must sign in again.
				expect(
					await screen.findByText(messages.en.serverErrors.accountChanged),
				).toBeTruthy();
				expect(screen.queryByText(copy.failed)).toBeNull();
				expect(updatePassword).toHaveBeenCalledTimes(1);
			},
		);

		it("closes the sheet and offers signing in again when the session ended", async () => {
			offer("needs_first_factor", ["password"]);
			attemptFirst.mockRejectedValue({
				errors: [{ code: "session_not_found" }],
			});
			await submitChange();
			expect(await screen.findByLabelText(copy.signInAgain)).toBeTruthy();
			expect(screen.queryByText(reverifyCopy.title)).toBeNull();
			// Change password's own wording, never the deleting one.
			expect(
				screen.getByText(messages.en.auth.errors.signInAgain),
			).toBeTruthy();
		});

		it.each([
			["accountSignInFirst", "en"],
			["accountSessionEnded", "en"],
			["accountChanged", "en"],
			["accountSignInFirst", "nl"],
			["accountSessionEnded", "nl"],
			["accountChanged", "nl"],
		] as const)(
			"words %s for every flow, deleting not among them (%s)",
			(key, locale) => {
				expect(messages[locale].serverErrors[key]).not.toMatch(
					/delet|verwijder/i,
				);
			},
		);

		it("says why in an alert when a 401 signed the phone out before the answer", async () => {
			offer("needs_first_factor", ["password"]);
			let reject!: (reason: unknown) => void;
			attemptFirst.mockReturnValue(
				new Promise((_resolve, fail) => {
					reject = fail;
				}),
			);
			const view = await submitChange();
			await waitFor(() => expect(attemptFirst).toHaveBeenCalled());
			// The signed-out app drops this screen first.
			await view.unmount();
			await act(async () => {
				reject({ errors: [{ code: "session_not_found" }] });
			});
			expect(Alert.alert).toHaveBeenCalledTimes(1);
			expect(Alert.alert).toHaveBeenCalledWith(
				messages.en.profile.reverify.endedTitle,
				messages.en.serverErrors.accountSessionEnded,
			);
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
