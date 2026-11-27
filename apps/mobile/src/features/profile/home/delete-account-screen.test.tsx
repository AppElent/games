import { messages } from "@arcadeclub/core/messages";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { renderScreen } from "../../../../test/render-screen";
import { takeReturnTarget } from "../../../auth/return-target";
import { DeleteAccountScreen } from "./delete-account-screen";

const copy = messages.en.profile.deleteAccount;
const reverifyCopy = messages.en.profile.reverify;
const mockRouter = { push: jest.fn(), dismissTo: jest.fn() };
const mockSignOut = jest.fn();
const mockDeleteMyData = jest.fn();
const mockPrepareFirstFactor = jest.fn();
const mockAttemptFirstFactor = jest.fn();
let mockUser: {
	id: string;
	deleteSelfEnabled: boolean;
	primaryEmailAddress?: { emailAddress: string };
} | null;
let mockSession: {
	id: string;
	reload: () => Promise<void>;
	checkAuthorization: () => boolean;
	startVerification: () => Promise<unknown>;
	prepareFirstFactorVerification: typeof mockPrepareFirstFactor;
	attemptFirstFactorVerification: typeof mockAttemptFirstFactor;
} | null;

jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useRouter: () => mockRouter,
}));
jest.mock("@clerk/expo", () => ({
	useUser: () => ({ user: mockUser }),
	useAuth: () => ({ isSignedIn: mockUser !== null, signOut: mockSignOut }),
	useClerk: () => ({ session: mockSession, user: mockUser }),
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
	useMutation: () => mockDeleteMyData,
}));
jest.mock("../../sudoku/saves/sudoku-save-store", () => ({
	forgetAccountSaves: jest.fn(),
}));

/** Chooses to delete, and confirms it in the native alert. */
async function confirmDeletionAlert(scope?: string) {
	const view = await renderScreen(<DeleteAccountScreen />);
	if (scope) await fireEvent.press(screen.getByText(scope));
	await pressDelete();
	return view;
}

async function pressDelete() {
	await fireEvent.press(screen.getByTestId("delete-account-continue"));
	const buttons = jest.mocked(Alert.alert).mock.lastCall?.[2];
	await act(async () => {
		buttons?.find(({ style }) => style === "destructive")?.onPress?.();
	});
}

async function confirmDeletion() {
	await confirmDeletionAlert();
	expect(
		await screen.findByText(messages.en.serverErrors.accountSessionEnded),
	).toBeTruthy();
}

describe("DeleteAccountScreen once the session ended", () => {
	beforeEach(() => {
		jest
			.spyOn(Alert, "alert")
			.mockReset()
			.mockImplementation(() => {});
		for (const mock of [
			mockRouter.push,
			mockRouter.dismissTo,
			mockSignOut,
			mockDeleteMyData,
		]) {
			mock.mockReset();
		}
		mockSignOut.mockResolvedValue(undefined);
		mockUser = { id: "user_1", deleteSelfEnabled: true };
		// The session ended: Clerk has none, whether or not it still has the user.
		mockSession = null;
		takeReturnTarget("user_1");
	});

	it("signs in over this screen when nobody is signed in", async () => {
		mockUser = null;
		await confirmDeletion();
		await fireEvent.press(screen.getByLabelText(copy.signInAgain));
		expect(mockRouter.push).toHaveBeenCalledWith("/sign-in");
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		expect(mockSignOut).not.toHaveBeenCalled();

		// Closing that sign-in leaves the button usable.
		await fireEvent.press(screen.getByLabelText(copy.signInAgain));
		expect(mockRouter.push).toHaveBeenCalledTimes(2);
	});

	it("signs the remaining user out first, to come back here", async () => {
		await confirmDeletion();
		await fireEvent.press(screen.getByLabelText(copy.signInAgain));
		await waitFor(() =>
			expect(mockRouter.push).toHaveBeenCalledWith("/sign-in"),
		);
		expect(mockSignOut).toHaveBeenCalledTimes(1);
		expect(takeReturnTarget("user_1")).toBe("/profile/delete-account");
	});
});

describe("DeleteAccountScreen re-verify sheet", () => {
	let recentSignIn: boolean;

	beforeEach(() => {
		jest
			.spyOn(Alert, "alert")
			.mockReset()
			.mockImplementation(() => {});
		for (const mock of [
			mockRouter.push,
			mockRouter.dismissTo,
			mockSignOut,
			mockDeleteMyData,
			mockPrepareFirstFactor,
			mockAttemptFirstFactor,
		]) {
			mock.mockReset();
		}
		recentSignIn = false;
		mockSignOut.mockResolvedValue(undefined);
		mockDeleteMyData.mockResolvedValue({ done: true });
		mockPrepareFirstFactor.mockResolvedValue({});
		mockAttemptFirstFactor.mockImplementation(async () => {
			recentSignIn = true;
			return { status: "complete" };
		});
		mockUser = {
			id: "user_1",
			deleteSelfEnabled: true,
			primaryEmailAddress: { emailAddress: "ann@example.com" },
		};
		mockSession = {
			id: "sess_1",
			reload: async () => {},
			checkAuthorization: () => recentSignIn,
			startVerification: async () => ({
				status: "needs_first_factor",
				supportedFirstFactors: [
					{ strategy: "password" },
					{
						strategy: "email_code",
						emailAddressId: "email_1",
						safeIdentifier: "ann@example.com",
						primary: true,
					},
				],
			}),
			prepareFirstFactorVerification: mockPrepareFirstFactor,
			attemptFirstFactorVerification: mockAttemptFirstFactor,
		};
	});

	it("mounts the sheet for an old sign-in, switches to code and back, and finishes deletion", async () => {
		await confirmDeletionAlert();
		expect(await screen.findByText(reverifyCopy.title)).toBeTruthy();

		// Switch to emailed code, then back to password without cancelling.
		await fireEvent.press(screen.getByTestId("reverify-email-code"));
		expect(await screen.findByTestId("reverify-use-password")).toBeTruthy();
		await fireEvent.press(screen.getByTestId("reverify-use-password"));
		expect(await screen.findByTestId("reverify-password")).toBeTruthy();

		// Wrong password stays on the sheet and deletes nothing.
		mockAttemptFirstFactor.mockRejectedValueOnce({
			code: "api_response_error",
			errors: [{ code: "form_password_incorrect", message: "Wrong" }],
		});
		await fireEvent.changeText(
			screen.getByTestId("reverify-password"),
			"wrong",
		);
		await fireEvent.press(screen.getByTestId("reverify-submit"));
		expect(
			await screen.findByText(messages.en.auth.errors.passwordIncorrect),
		).toBeTruthy();
		expect(mockDeleteMyData).not.toHaveBeenCalled();

		// Right password completes deletion and returns to Profile.
		await fireEvent.changeText(
			screen.getByTestId("reverify-password"),
			"secret",
		);
		await fireEvent.press(screen.getByTestId("reverify-submit"));
		await waitFor(() =>
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/profile"),
		);
		expect(mockDeleteMyData).toHaveBeenCalledWith({
			expectedSubject: "user_1",
		});
	});

	it("deletes after a wrong, then a right authenticator code, asking no password", async () => {
		const attempt = jest
			.fn()
			.mockRejectedValueOnce({
				code: "api_response_error",
				errors: [{ code: "form_code_incorrect", message: "Wrong" }],
			})
			.mockImplementationOnce(async () => {
				recentSignIn = true;
				return { status: "complete" };
			});
		Object.assign(mockSession as object, {
			startVerification: async () => ({
				status: "needs_second_factor",
				supportedFirstFactors: null,
				supportedSecondFactors: [{ strategy: "totp" }],
			}),
			attemptSecondFactorVerification: attempt,
		});
		await confirmDeletionAlert();
		expect(await screen.findByText(reverifyCopy.title)).toBeTruthy();
		expect(screen.queryByTestId("reverify-password")).toBeNull();
		const enter = async (code: string) => {
			await fireEvent.changeText(
				screen.getByTestId("second-factor-code"),
				code,
			);
			await fireEvent.press(screen.getByTestId("second-factor-submit"));
		};
		await enter("000000");
		expect(
			await screen.findByText(messages.en.auth.errors.codeIncorrect),
		).toBeTruthy();
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		await enter("123456");
		await waitFor(() =>
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/profile"),
		);
		expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
	});

	it("closes the sheet and offers signing in again when the session ended", async () => {
		await confirmDeletionAlert();
		mockAttemptFirstFactor.mockRejectedValueOnce({
			errors: [{ code: "session_not_found" }],
		});
		await fireEvent.changeText(
			await screen.findByTestId("reverify-password"),
			"secret",
		);
		await fireEvent.press(screen.getByTestId("reverify-submit"));
		expect(
			await screen.findByText(messages.en.serverErrors.accountSessionEnded),
		).toBeTruthy();
		expect(screen.queryByText(reverifyCopy.title)).toBeNull();
		expect(screen.getByLabelText(copy.signInAgain)).toBeTruthy();
		expect(mockDeleteMyData).not.toHaveBeenCalled();
	});

	it("closes the mounted sheet on cancel without deleting anything", async () => {
		await confirmDeletionAlert();
		expect(await screen.findByText(reverifyCopy.title)).toBeTruthy();
		await fireEvent.press(screen.getByTestId("reverify-cancel"));
		await waitFor(() =>
			expect(screen.queryByText(reverifyCopy.title)).toBeNull(),
		);
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
	});

	it("says why in an alert when a 401 signed the phone out before the answer", async () => {
		let reject!: (reason: unknown) => void;
		mockAttemptFirstFactor.mockReturnValue(
			new Promise((_resolve, fail) => {
				reject = fail;
			}),
		);
		const view = await confirmDeletionAlert();
		await fireEvent.changeText(
			await screen.findByTestId("reverify-password"),
			"secret",
		);
		await fireEvent.press(screen.getByTestId("reverify-submit"));
		await waitFor(() => expect(mockAttemptFirstFactor).toHaveBeenCalled());
		// The signed-out app drops this screen first.
		await view.unmount();
		await act(async () => {
			reject({ errors: [{ code: "session_not_found" }] });
		});
		expect(Alert.alert).toHaveBeenLastCalledWith(
			reverifyCopy.endedTitle,
			messages.en.serverErrors.accountSessionEnded,
		);
		expect(mockDeleteMyData).not.toHaveBeenCalled();
	});

	describe("once the data is gone", () => {
		const finish = messages.en.serverErrors.accountSignInToFinish;

		it("keeps saying so when the sheet's 401 lands after the screen went", async () => {
			recentSignIn = true;
			Object.assign(mockUser as object, {
				delete: jest.fn().mockRejectedValue({
					errors: [{ code: "session_reverification_required" }],
				}),
			});
			let reject!: (reason: unknown) => void;
			mockAttemptFirstFactor.mockReset().mockReturnValue(
				new Promise((_resolve, fail) => {
					reject = fail;
				}),
			);
			const view = await confirmDeletionAlert(copy.account.label);
			await fireEvent.changeText(
				await screen.findByTestId("reverify-password"),
				"secret",
			);
			await fireEvent.press(screen.getByTestId("reverify-submit"));
			// Leaving closes the sheet, which says the data is gone right away.
			await view.unmount();
			expect(Alert.alert).toHaveBeenLastCalledWith(
				copy.unfinishedTitle,
				messages.en.serverErrors.accountDeleteAgain,
			);
			await act(async () => {
				reject({ errors: [{ code: "session_not_found" }] });
			});
			// The confirmation, then that one: the 401 adds no second alert.
			expect(Alert.alert).toHaveBeenCalledTimes(2);
		});

		it.each([true, false])(
			"keeps saying so when deleting the account hits a 401 (screen gone: %s)",
			async (gone) => {
				recentSignIn = true;
				let reject!: (reason: unknown) => void;
				Object.assign(mockUser as object, {
					delete: () =>
						new Promise((_resolve, fail) => {
							reject = fail;
						}),
				});
				const view = await confirmDeletionAlert(copy.account.label);
				await waitFor(() => expect(mockDeleteMyData).toHaveBeenCalled());
				if (gone) await view.unmount();
				await act(async () => {
					reject({ status: 401, errors: [{ code: "session_not_found" }] });
				});
				if (gone) {
					expect(Alert.alert).toHaveBeenLastCalledWith(
						copy.unfinishedTitle,
						finish,
					);
				} else {
					expect(screen.getByText(finish)).toBeTruthy();
					expect(screen.getByLabelText(copy.signInAgain)).toBeTruthy();
				}
			},
		);

		it("keeps saying so when trying again, as the screen asks, hits a 401", async () => {
			recentSignIn = true;
			Object.assign(mockUser as object, {
				delete: jest.fn().mockRejectedValue({
					errors: [{ code: "session_reverification_required" }],
				}),
			});
			await confirmDeletionAlert(copy.account.label);
			await fireEvent.press(await screen.findByTestId("reverify-cancel"));
			await screen.findByText(messages.en.serverErrors.accountDeleteAgain);
			recentSignIn = false;
			mockAttemptFirstFactor.mockReset().mockImplementation(async () => {
				mockSession = null;
				throw { errors: [{ code: "session_not_found" }] };
			});
			await pressDelete();
			await fireEvent.changeText(
				await screen.findByTestId("reverify-password"),
				"secret",
			);
			await fireEvent.press(screen.getByTestId("reverify-submit"));
			expect(await screen.findByText(finish)).toBeTruthy();
			expect(mockDeleteMyData).toHaveBeenCalledTimes(1);

			// Signed out by now: trying once more still says it.
			await pressDelete();
			expect(await screen.findByText(finish)).toBeTruthy();
		});
		it("says so in an alert when deleting the account fails after the screen went", async () => {
			recentSignIn = true;
			let reject!: (reason: unknown) => void;
			Object.assign(mockUser as object, {
				delete: () =>
					new Promise((_resolve, fail) => {
						reject = fail;
					}),
			});
			const view = await confirmDeletionAlert(copy.account.label);
			await waitFor(() => expect(mockDeleteMyData).toHaveBeenCalled());
			await view.unmount();
			await act(async () => {
				reject(new Error("offline"));
			});
			expect(Alert.alert).toHaveBeenLastCalledWith(
				copy.unfinishedTitle,
				messages.en.serverErrors.accountDeleteAgain,
			);
			// The confirmation, then this one.
			expect(Alert.alert).toHaveBeenCalledTimes(2);
		});

		it("says so in an alert when the screen goes before the sheet opens", async () => {
			recentSignIn = true;
			Object.assign(mockUser as object, {
				delete: jest.fn().mockRejectedValue({
					errors: [{ code: "session_reverification_required" }],
				}),
			});
			let answer!: (value: unknown) => void;
			Object.assign(mockSession as object, {
				startVerification: () =>
					new Promise((resolve) => {
						answer = resolve;
					}),
			});
			const view = await confirmDeletionAlert(copy.account.label);
			await waitFor(() => expect(answer).toBeDefined());
			await view.unmount();
			await act(async () => {
				answer({
					status: "needs_first_factor",
					supportedFirstFactors: [{ strategy: "password" }],
				});
			});
			expect(Alert.alert).toHaveBeenLastCalledWith(
				copy.unfinishedTitle,
				messages.en.serverErrors.accountDeleteAgain,
			);
			expect(Alert.alert).toHaveBeenCalledTimes(2);
		});

		/** A whole-account run that deletes the data, then stops at the account. */
		async function deleteDataOnly() {
			recentSignIn = true;
			Object.assign(mockUser as object, {
				delete: jest.fn().mockRejectedValue({
					errors: [{ code: "session_reverification_required" }],
				}),
			});
			await confirmDeletionAlert(copy.account.label);
			await fireEvent.press(await screen.findByTestId("reverify-cancel"));
			await screen.findByText(messages.en.serverErrors.accountDeleteAgain);
			expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
		}

		it("doesn't advise deleting the whole account once Arcade Club data only is chosen", async () => {
			await deleteDataOnly();
			await fireEvent.press(screen.getByText(copy.app.label));
			recentSignIn = false;
			mockAttemptFirstFactor.mockReset().mockImplementation(async () => {
				mockSession = null;
				throw { errors: [{ code: "session_not_found" }] };
			});
			await pressDelete();
			await fireEvent.changeText(
				await screen.findByTestId("reverify-password"),
				"secret",
			);
			await fireEvent.press(screen.getByTestId("reverify-submit"));
			expect(
				await screen.findByText(messages.en.serverErrors.accountSessionEnded),
			).toBeTruthy();
			expect(screen.queryByText(finish)).toBeNull();

			// Signed out by now: trying again says the same.
			await pressDelete();
			expect(
				await screen.findByText(messages.en.serverErrors.accountSessionEnded),
			).toBeTruthy();
			expect(screen.queryByText(finish)).toBeNull();
		});

		it("stays quiet when an Arcade Club data only retry is cancelled", async () => {
			await deleteDataOnly();
			await fireEvent.press(screen.getByText(copy.app.label));
			recentSignIn = false;
			await pressDelete();
			await fireEvent.press(await screen.findByTestId("reverify-cancel"));
			await waitFor(() =>
				expect(screen.queryByText(reverifyCopy.title)).toBeNull(),
			);
			expect(
				screen.queryByText(messages.en.serverErrors.accountDeleteAgain),
			).toBeNull();
		});

		it("still says so when a retry is cancelled", async () => {
			await deleteDataOnly();
			recentSignIn = false;
			await pressDelete();
			expect(await screen.findByText(reverifyCopy.title)).toBeTruthy();
			// The retry cleared the last message.
			expect(
				screen.queryByText(messages.en.serverErrors.accountDeleteAgain),
			).toBeNull();
			await fireEvent.press(screen.getByTestId("reverify-cancel"));
			expect(
				await screen.findByText(messages.en.serverErrors.accountDeleteAgain),
			).toBeTruthy();
			expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
		});

		it("still says so when a retry fails for another reason", async () => {
			await deleteDataOnly();
			mockDeleteMyData.mockRejectedValueOnce(new Error("offline"));
			await pressDelete();
			await waitFor(() => expect(mockDeleteMyData).toHaveBeenCalledTimes(2));
			expect(
				await screen.findByText(messages.en.serverErrors.accountDeleteAgain),
			).toBeTruthy();
			expect(screen.queryByText(copy.failed)).toBeNull();
		});

		it("still says so when the retry's sheet can't do the second step", async () => {
			await deleteDataOnly();
			recentSignIn = false;
			Object.assign(mockSession as object, {
				startVerification: async () => ({
					status: "needs_second_factor",
					supportedSecondFactors: [{ strategy: "passkey" }],
				}),
			});
			await pressDelete();
			expect(
				await screen.findByText(
					messages.en.serverErrors.accountSecondFactorToFinish,
				),
			).toBeTruthy();
		});
	});

	it.each([true, false])(
		"says the session ended when Convex wants a sign-in mid-deletion (screen gone: %s)",
		async (gone) => {
			recentSignIn = true;
			let reject!: (reason: unknown) => void;
			mockDeleteMyData.mockReturnValue(
				new Promise((_resolve, fail) => {
					reject = fail;
				}),
			);
			const view = await confirmDeletionAlert(copy.account.label);
			await waitFor(() => expect(mockDeleteMyData).toHaveBeenCalled());
			if (gone) await view.unmount();
			await act(async () => {
				reject({ data: { code: "signInRequired" } });
			});
			const ended = messages.en.serverErrors.accountSessionEnded;
			if (gone) {
				expect(Alert.alert).toHaveBeenLastCalledWith(
					reverifyCopy.endedTitle,
					ended,
				);
			} else {
				expect(screen.getByText(ended)).toBeTruthy();
				expect(screen.getByLabelText(copy.signInAgain)).toBeTruthy();
			}
		},
	);

	it("tells what to do next, not to delete again, when the second factor can't be done after the data is gone", async () => {
		recentSignIn = true;
		const refusal = { errors: [{ code: "session_reverification_required" }] };
		Object.assign(mockUser as object, {
			delete: jest.fn().mockRejectedValue(refusal),
		});
		Object.assign(mockSession as object, {
			startVerification: async () => ({
				status: "needs_second_factor",
				supportedSecondFactors: [{ strategy: "passkey" }],
			}),
		});
		await confirmDeletionAlert(copy.account.label);
		expect(
			await screen.findByText(
				messages.en.serverErrors.accountSecondFactorToFinish,
			),
		).toBeTruthy();
		expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
		expect(
			screen.queryByText(messages.en.serverErrors.accountDeleteAgain),
		).toBeNull();
		// Signing in again would meet the same second step.
		expect(screen.queryByLabelText(copy.signInAgain)).toBeNull();
	});
});
