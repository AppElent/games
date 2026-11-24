/**
 * The three ways into the second step and the step itself, on the real
 * screens. Clerk's sign-in and the router are mocked at the edge.
 */
import { messages } from "@arcadeclub/core/messages";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { remove, STORAGE_KEYS, writeText } from "../../../storage/local-store";
import { PasswordResetScreen } from "../password-reset/password-reset-screen";
import { SignInCodeScreen } from "../sign-in/sign-in-code-screen";
import { SignInScreen } from "../sign-in/sign-in-screen";
import { SecondFactorScreen } from "./second-factor-screen";

const mockRouter = {
	push: jest.fn(),
	replace: jest.fn(),
	back: jest.fn(),
	dismissTo: jest.fn(),
};
let mockBlur: () => void = () => {};
jest.mock("expo-router", () => ({
	useRouter: () => mockRouter,
	useFocusEffect: (effect: () => () => void) =>
		jest.requireActual("react").useEffect(() => {
			const blur = effect();
			mockBlur = blur;
			return blur;
		}, [effect]),
}));

type Factor = { strategy: string; safeIdentifier?: string };
const mockSignIn = {
	status: "needs_identifier" as string,
	supportedSecondFactors: [] as Factor[],
	password: jest.fn(),
	create: jest.fn(),
	finalize: jest.fn(),
	reset: jest.fn(),
	emailCode: { sendCode: jest.fn(), verifyCode: jest.fn() },
	resetPasswordEmailCode: {
		sendCode: jest.fn(),
		verifyCode: jest.fn(),
		submitPassword: jest.fn(),
	},
	mfa: {
		sendPhoneCode: jest.fn(),
		sendEmailCode: jest.fn(),
		verifyTOTP: jest.fn(),
		verifyPhoneCode: jest.fn(),
		verifyEmailCode: jest.fn(),
		verifyBackupCode: jest.fn(),
	},
};
const mockErrors = { fields: {}, global: null };
jest.mock("@clerk/expo", () => ({
	useSignIn: () => ({ signIn: mockSignIn, errors: mockErrors }),
}));

jest.mock("../../../auth/config", () => ({ devLogin: null }));

const t = messages.en;
const copy = t.auth.secondFactor;
const ok = { error: null };
const refused = (code: string, extra?: object) => ({
	error: { errors: [{ code, message: "Raw Clerk English", ...extra }] },
});
const becomes = (status: string) => async () => {
	mockSignIn.status = status;
	return ok;
};
const SECOND = "/sign-in-second-factor";

const type = (testID: string, text: string) =>
	fireEvent.changeText(screen.getByTestId(testID), text);
const press = (label: string) =>
	fireEvent.press(screen.getByRole("button", { name: label }));

async function openStep(factors: Factor[], props = {}) {
	mockSignIn.status = "needs_second_factor";
	mockSignIn.supportedSecondFactors = factors;
	await renderScreen(<SecondFactorScreen {...props} />);
}

beforeEach(() => {
	jest.resetAllMocks();
	remove(STORAGE_KEYS.locale);
	mockSignIn.status = "needs_identifier";
	for (const group of [
		mockSignIn.emailCode,
		mockSignIn.resetPasswordEmailCode,
		mockSignIn.mfa,
	]) {
		for (const fn of Object.values(group)) fn.mockResolvedValue(ok);
	}
	mockSignIn.create.mockResolvedValue(ok);
	mockSignIn.finalize.mockResolvedValue(ok);
	mockSignIn.reset.mockResolvedValue(ok);
});

afterEach(() => remove(STORAGE_KEYS.locale));

describe("the way in", () => {
	it.each(["needs_second_factor", "needs_client_trust"])(
		"opens after a password that ends in %s",
		async (status) => {
			mockSignIn.password.mockImplementation(becomes(status));
			await renderScreen(<SignInScreen />);
			await type("sign-in-email", "ann@example.com");
			await type("sign-in-password", "secret");
			await press(t.auth.signIn.submit);
			await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(SECOND));
			expect(mockSignIn.finalize).not.toHaveBeenCalled();
		},
	);

	it("leaves a password that needs no second step alone", async () => {
		mockSignIn.password.mockImplementation(becomes("complete"));
		await renderScreen(<SignInScreen />);
		await type("sign-in-email", "ann@example.com");
		await type("sign-in-password", "secret");
		await press(t.auth.signIn.submit);
		await waitFor(() => expect(mockSignIn.finalize).toHaveBeenCalledTimes(1));
		expect(mockRouter.push).not.toHaveBeenCalled();
	});

	it("says so for a step the app does not offer", async () => {
		mockSignIn.password.mockImplementation(becomes("needs_new_password"));
		await renderScreen(<SignInScreen />);
		await type("sign-in-email", "ann@example.com");
		await type("sign-in-password", "secret");
		await press(t.auth.signIn.submit);
		expect(await screen.findByText(t.auth.signIn.unsupportedStep)).toBeTruthy();
		expect(mockRouter.push).not.toHaveBeenCalled();
	});

	it("opens after an emailed code", async () => {
		mockSignIn.emailCode.verifyCode.mockImplementation(
			becomes("needs_second_factor"),
		);
		await renderScreen(<SignInCodeScreen email="ann@example.com" />);
		await fireEvent.changeText(
			screen.getByLabelText(t.auth.signInCode.code),
			"424242",
		);
		await press(t.auth.signInCode.submit);
		await waitFor(() =>
			expect(mockRouter.replace).toHaveBeenCalledWith(SECOND),
		);
		expect(mockSignIn.finalize).not.toHaveBeenCalled();
	});

	it("opens after a password reset", async () => {
		mockSignIn.resetPasswordEmailCode.submitPassword.mockImplementation(
			becomes("needs_second_factor"),
		);
		await renderScreen(<PasswordResetScreen initialEmail="ann@example.com" />);
		await press(t.auth.reset.sendCode);
		await fireEvent.changeText(
			await screen.findByLabelText(t.auth.signInCode.code),
			"424242",
		);
		await type("reset-new-password", "new-secret");
		await press(t.auth.reset.submit);
		await waitFor(() =>
			expect(mockRouter.replace).toHaveBeenCalledWith({
				pathname: SECOND,
				params: { from: "reset" },
			}),
		);
		expect(mockSignIn.finalize).not.toHaveBeenCalled();
	});
});

describe("a first step answered after its screen is gone", () => {
	type Call = jest.Mock;
	async function answerLate(call: Call, submit: () => Promise<unknown>) {
		let answer = () => {};
		call.mockImplementation(
			() =>
				new Promise((resolve) => {
					answer = () => {
						mockSignIn.status = "needs_second_factor";
						resolve(ok);
					};
				}),
		);
		// Some handlers hand their promise to the press, which waits for it.
		const pressed = submit();
		await waitFor(() => expect(call).toHaveBeenCalled());
		mockBlur();
		await act(async () => answer());
		await pressed;
		expect(mockRouter.push).not.toHaveBeenCalled();
		expect(mockRouter.replace).not.toHaveBeenCalled();
		// A newer attempt may be running.
		expect(mockSignIn.reset).not.toHaveBeenCalled();
	}

	it("opens nothing after a password", async () => {
		await renderScreen(<SignInScreen />);
		await type("sign-in-email", "ann@example.com");
		await type("sign-in-password", "secret");
		await answerLate(mockSignIn.password, async () =>
			press(t.auth.signIn.submit),
		);
	});

	it("opens nothing after an emailed code", async () => {
		await renderScreen(<SignInCodeScreen email="ann@example.com" />);
		await fireEvent.changeText(
			screen.getByLabelText(t.auth.signInCode.code),
			"424242",
		);
		await answerLate(mockSignIn.emailCode.verifyCode, async () =>
			press(t.auth.signInCode.submit),
		);
	});

	it("opens nothing after a password reset", async () => {
		await renderScreen(<PasswordResetScreen initialEmail="ann@example.com" />);
		await press(t.auth.reset.sendCode);
		await fireEvent.changeText(
			await screen.findByLabelText(t.auth.signInCode.code),
			"424242",
		);
		await type("reset-new-password", "new-secret");
		await answerLate(
			mockSignIn.resetPasswordEmailCode.submitPassword,
			async () => press(t.auth.reset.submit),
		);
	});
});

describe("SecondFactorScreen", () => {
	const ALL = [{ strategy: "backup_code" }, { strategy: "totp" }];

	it("signs in with an authenticator code", async () => {
		mockSignIn.mfa.verifyTOTP.mockImplementation(becomes("complete"));
		await openStep(ALL);
		expect(screen.getByText(copy.prompt.totp)).toBeTruthy();
		expect(screen.getByLabelText(t.auth.signInCode.code).props).toMatchObject({
			textContentType: "oneTimeCode",
			autoComplete: "one-time-code",
		});
		await type("second-factor-code", "123 456");
		await press(copy.submit);
		await waitFor(() => expect(mockSignIn.finalize).toHaveBeenCalledTimes(1));
		expect(mockSignIn.mfa.verifyTOTP).toHaveBeenCalledWith({ code: "123456" });
	});

	it("shows a wrong code in Dutch, never Clerk's text", async () => {
		writeText(STORAGE_KEYS.locale, "nl");
		mockSignIn.mfa.verifyTOTP.mockResolvedValue(refused("form_code_incorrect"));
		await openStep(ALL);
		await type("second-factor-code", "000000");
		await press(messages.nl.auth.secondFactor.submit);
		expect(
			await screen.findByText(messages.nl.auth.errors.codeIncorrect),
		).toBeTruthy();
		expect(screen.queryByText("Raw Clerk English")).toBeNull();
		expect(mockSignIn.finalize).not.toHaveBeenCalled();
		expect(screen.getByTestId("second-factor-code").props.value).toBe("000000");
	});

	it("says how long a locked account has to wait", async () => {
		mockSignIn.mfa.verifyTOTP.mockResolvedValue(
			refused("user_locked", { meta: { lockout_expires_in_seconds: 600 } }),
		);
		await openStep(ALL);
		await type("second-factor-code", "000000");
		await press(copy.submit);
		expect(await screen.findByText(/Try again in 10 minutes\./)).toBeTruthy();
	});

	it("signs in with a backup code", async () => {
		mockSignIn.mfa.verifyBackupCode.mockImplementation(becomes("complete"));
		await openStep(ALL);
		await press(copy.switchTo.backup_code);
		expect(await screen.findByLabelText(copy.backupCode)).toBeTruthy();
		await type("second-factor-code", "ab12cd34");
		await press(copy.submit);
		await waitFor(() => expect(mockSignIn.finalize).toHaveBeenCalledTimes(1));
		expect(mockSignIn.mfa.verifyBackupCode).toHaveBeenCalledWith({
			code: "ab12cd34",
		});
	});

	it("drops a locked method's field and leaves the other one", async () => {
		mockSignIn.mfa.verifyTOTP.mockResolvedValue(refused("verification_failed"));
		await openStep(ALL);
		await type("second-factor-code", "000000");
		await press(copy.submit);
		expect(await screen.findByText(copy.methodLocked)).toBeTruthy();
		expect(screen.queryByTestId("second-factor-code")).toBeNull();
		await press(copy.switchTo.backup_code);
		expect(await screen.findByLabelText(copy.backupCode)).toBeTruthy();
	});

	it("sends an emailed code once, and again when asked", async () => {
		await openStep([{ strategy: "email_code", safeIdentifier: "a***@b.com" }]);
		await waitFor(() =>
			expect(mockSignIn.mfa.sendEmailCode).toHaveBeenCalledTimes(1),
		);
		expect(
			screen.getByText("We sent a 6-digit code to a***@b.com."),
		).toBeTruthy();
		await type("second-factor-code", "111111");
		await press(t.auth.signInCode.resend);
		expect(await screen.findByText(t.auth.signInCode.resent)).toBeTruthy();
		await waitFor(() =>
			expect(screen.getByTestId("second-factor-code").props.value).toBe(""),
		);
		expect(mockSignIn.mfa.sendEmailCode).toHaveBeenCalledTimes(2);
	});

	it("says what to do when the account only has a factor we can't handle", async () => {
		await openStep([{ strategy: "passkey" }]);
		expect(screen.getByText(copy.noMethod)).toBeTruthy();
		expect(screen.queryByTestId("second-factor-code")).toBeNull();
		await press(copy.backToSignIn);
		await waitFor(() =>
			expect(mockRouter.dismissTo).toHaveBeenCalledWith("/sign-in"),
		);
		expect(mockSignIn.reset).toHaveBeenCalled();
	});

	it("says the attempt is over when there is none", async () => {
		await renderScreen(<SecondFactorScreen />);
		expect(screen.getByText(copy.attemptEnded)).toBeTruthy();
		expect(screen.queryByTestId("second-factor-code")).toBeNull();
	});

	it("says the password is changed after a reset", async () => {
		await openStep(ALL, { afterReset: true });
		expect(screen.getByText(copy.passwordChanged)).toBeTruthy();
	});
});
