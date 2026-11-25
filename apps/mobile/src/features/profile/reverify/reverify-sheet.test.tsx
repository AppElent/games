import type { AuthError, AuthErrorKey } from "@arcadeclub/core/auth-errors";
import { messages } from "@arcadeclub/core/messages";
import { useUser } from "@clerk/expo";
import { fireEvent, screen } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { remove, STORAGE_KEYS, writeText } from "../../../storage/local-store";
import { type ReverifyPurpose, ReverifySheet } from "./reverify-sheet";
import type { useReverify } from "./use-reverify";

const t = messages.en;
const copy = t.profile.reverify;

type Reverify = ReturnType<typeof useReverify>;

async function open(
	state: Partial<Reverify>,
	purpose: ReverifyPurpose = "delete",
) {
	const error =
		state.error !== undefined
			? state.error
			: state.errorKey
				? { key: state.errorKey }
				: null;
	const reverify = {
		verify: jest.fn(),
		method: "password",
		hasPassword: true,
		email: null,
		busy: false,
		sending: false,
		secondFactor: null,
		error,
		errorKey: error?.key ?? null,
		codeSent: false,
		submit: jest.fn(),
		sendCode: jest.fn(),
		usePassword: jest.fn(),
		cancel: jest.fn(),
		...state,
		...(state.error === undefined
			? { error, errorKey: error?.key ?? null }
			: {}),
	} as jest.Mocked<Reverify>;
	await renderScreen(<ReverifySheet reverify={reverify} purpose={purpose} />);
	return reverify;
}

beforeEach(() => {
	remove(STORAGE_KEYS.locale);
	jest.mocked(useUser).mockReturnValue({
		user: { primaryEmailAddress: { emailAddress: "ann@example.com" } },
	} as never);
});

afterEach(() => {
	remove(STORAGE_KEYS.locale);
});

describe("ReverifySheet", () => {
	it("stays closed until something asks for it", async () => {
		await open({ method: null });
		expect(screen.queryByText(copy.title)).toBeNull();
	});

	it("confirms with the password", async () => {
		const reverify = await open({});
		expect(screen.getByText(copy.title)).toBeTruthy();
		expect(screen.getByDisplayValue("ann@example.com")).toBeTruthy();
		expect(screen.queryByLabelText(copy.emailCode)).toBeNull();
		await fireEvent.changeText(
			screen.getByLabelText(t.auth.signIn.password),
			"secret",
		);
		await fireEvent.press(screen.getByLabelText(copy.delete.submit));
		expect(reverify.submit).toHaveBeenCalledWith("secret");
	});

	it("does not submit an empty password", async () => {
		const reverify = await open({});
		await fireEvent.press(screen.getByLabelText(copy.delete.submit));
		expect(reverify.submit).not.toHaveBeenCalled();
	});

	it("offers a code instead of the password when Clerk does", async () => {
		const reverify = await open({ email: "a***@example.com" });
		await fireEvent.press(screen.getByLabelText(copy.emailCode));
		expect(reverify.sendCode).toHaveBeenCalledTimes(1);
	});

	it("confirms with a whole emailed code and can send another", async () => {
		const reverify = await open({
			method: "code",
			hasPassword: false,
			email: "a***@example.com",
		});
		expect(screen.getByText(/a\*\*\*@example\.com/)).toBeTruthy();
		expect(screen.queryByLabelText(copy.usePassword)).toBeNull();
		const field = screen.getByLabelText(t.auth.signInCode.code);
		await fireEvent.changeText(field, "12345");
		await fireEvent.press(screen.getByLabelText(copy.delete.submit));
		expect(reverify.submit).not.toHaveBeenCalled();
		await fireEvent.changeText(field, "123456");
		await fireEvent.press(screen.getByLabelText(copy.delete.submit));
		expect(reverify.submit).toHaveBeenCalledWith("123456");
		await fireEvent.press(screen.getByLabelText(t.auth.signInCode.resend));
		expect(reverify.sendCode).toHaveBeenCalledTimes(1);
	});

	it("offers going back to the password only when the account has one", async () => {
		const reverify = await open({
			method: "code",
			hasPassword: true,
			email: "ann@example.com",
		});
		await fireEvent.press(screen.getByLabelText(copy.usePassword));
		expect(reverify.usePassword).toHaveBeenCalledTimes(1);
	});

	it("disables going back to the password while a code is sending", async () => {
		const reverify = await open({
			method: "code",
			hasPassword: true,
			sending: true,
			email: "ann@example.com",
		});
		await fireEvent.press(screen.getByLabelText(copy.usePassword));
		expect(reverify.usePassword).not.toHaveBeenCalled();
	});

	it.each<[Reverify["method"], AuthErrorKey]>([
		["password", "passwordIncorrect"],
		["code", "codeIncorrect"],
		["password", "tooManyRequests"],
		["code", "codeAttemptsExceeded"],
		["password", "accountLocked"],
	])("shows %s error %s inline", async (method, errorKey) => {
		await open({ method, errorKey });
		expect(screen.getByText(t.auth.errors[errorKey])).toBeTruthy();
	});

	it("shows the translated lockout wait when Clerk gives one", async () => {
		const error: AuthError = { key: "accountLocked", lockoutSeconds: 1800 };
		await open({ method: "password", error });
		expect(
			screen.getByText(
				"This account is temporarily locked after too many failed attempts. Try again in 30 minutes.",
			),
		).toBeTruthy();
	});

	it("says what confirming does when changing the password", async () => {
		await open({}, "changePassword");
		expect(screen.getByText(copy.changePassword.passwordBody)).toBeTruthy();
		expect(screen.getByLabelText(copy.changePassword.submit)).toBeTruthy();
		expect(screen.queryByText(copy.delete.passwordBody)).toBeNull();
	});

	describe.each(["en", "nl"] as const)("second step (%s)", (locale) => {
		const m = messages[locale];
		const second = m.auth.secondFactor;

		async function openSecond(verify = jest.fn(async () => ({ error: null }))) {
			writeText(STORAGE_KEYS.locale, locale);
			await open({
				method: "secondFactor",
				secondFactor: {
					factors: [{ strategy: "totp" }, { strategy: "backup_code" }],
					actions: { send: jest.fn(), verify },
				} as never,
			});
			return verify;
		}

		it("confirms with the authenticator app or a backup code", async () => {
			const verify = await openSecond();
			expect(screen.getByText(second.prompt.totp)).toBeTruthy();
			await fireEvent.press(
				screen.getByRole("button", { name: second.switchTo.backup_code }),
			);
			await fireEvent.changeText(
				screen.getByTestId("second-factor-code"),
				"abcd1234",
			);
			await fireEvent.press(
				screen.getByRole("button", { name: m.profile.reverify.delete.submit }),
			);
			expect(verify).toHaveBeenCalledWith("backup_code", "abcd1234");
		});

		it("words a spent method and an ended attempt for a confirmation", async () => {
			const verify = await openSecond();
			const submit = async (code: string) => {
				verify.mockResolvedValueOnce({
					error: { errors: [{ code }] },
				} as never);
				await fireEvent.changeText(
					screen.getByTestId("second-factor-code"),
					"123456",
				);
				await fireEvent.press(
					screen.getByRole("button", {
						name: m.profile.reverify.delete.submit,
					}),
				);
			};
			await submit("verification_failed");
			expect(screen.getByText(second.confirm.methodLocked)).toBeTruthy();
			await fireEvent.press(
				screen.getByRole("button", { name: second.switchTo.backup_code }),
			);
			await submit("resource_not_found");
			expect(screen.getByText(second.confirm.attemptEnded)).toBeTruthy();
		});
	});

	it("cancels", async () => {
		const reverify = await open({});
		await fireEvent.press(screen.getByLabelText(t.common.actions.cancel));
		expect(reverify.cancel).toHaveBeenCalledTimes(1);
	});

	describe("Dutch copy", () => {
		const nl = messages.nl;

		beforeEach(() => {
			writeText(STORAGE_KEYS.locale, "nl");
		});

		it("renders the password step and translated errors in Dutch", async () => {
			await open({
				method: "password",
				email: "ann@example.com",
				error: { key: "accountLocked", lockoutSeconds: 1800 },
			});
			expect(screen.getByText(nl.profile.reverify.title)).toBeTruthy();
			expect(
				screen.getByText(nl.profile.reverify.delete.passwordBody),
			).toBeTruthy();
			expect(screen.getByLabelText(nl.auth.signIn.password)).toBeTruthy();
			expect(
				screen.getByLabelText(nl.profile.reverify.delete.submit),
			).toBeTruthy();
			expect(screen.getByLabelText(nl.profile.reverify.emailCode)).toBeTruthy();
			expect(screen.getByLabelText(nl.common.actions.cancel)).toBeTruthy();
			expect(
				screen.getByText(
					"Dit account is tijdelijk vergrendeld na te veel mislukte pogingen. Probeer het over 30 minuten opnieuw.",
				),
			).toBeTruthy();
		});

		it("renders the code step, back-to-password control and errors in Dutch", async () => {
			const reverify = await open({
				method: "code",
				hasPassword: true,
				email: "ann@example.com",
				error: { key: "tooManyRequests" },
			});
			expect(screen.getByText(nl.profile.reverify.title)).toBeTruthy();
			expect(screen.getByText(/ann@example\.com/)).toBeTruthy();
			expect(screen.getByLabelText(nl.auth.signInCode.code)).toBeTruthy();
			expect(
				screen.getByLabelText(nl.profile.reverify.delete.submit),
			).toBeTruthy();
			expect(screen.getByLabelText(nl.auth.signInCode.resend)).toBeTruthy();
			expect(screen.getByText(nl.auth.errors.tooManyRequests)).toBeTruthy();
			await fireEvent.press(
				screen.getByLabelText(nl.profile.reverify.usePassword),
			);
			expect(reverify.usePassword).toHaveBeenCalledTimes(1);
		});
	});
});
