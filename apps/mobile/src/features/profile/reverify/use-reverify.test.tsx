import { authErrorMessage } from "@arcadeclub/core/auth-errors";
import { gameErrorData } from "@arcadeclub/core/errors";
import { messages } from "@arcadeclub/core/messages";
import { ClerkAPIResponseError } from "@clerk/react/errors";
import { act, renderHook } from "@testing-library/react-native";
import { reportError } from "../../../observability/report";
import { type ReverifyOutcome, useReverify } from "./use-reverify";

jest.mock("../../../observability/report", () => ({
	...jest.requireActual("../../../observability/report"),
	reportError: jest.fn(),
}));

const account = { userId: "user_1", sessionId: "sess_1" };
const password = { strategy: "password" };
const email = (id: string, primary: boolean) => ({
	strategy: "email_code",
	emailAddressId: id,
	safeIdentifier: `${id}@example.com`,
	primary,
});
const refusal = (
	code: string,
	extra?: Record<string, unknown>,
	wrapper?: Record<string, unknown>,
) =>
	Object.assign(new Error("Raw Clerk English"), {
		code: "api_response_error",
		errors: [{ code, message: "Raw Clerk English", ...extra }],
		...wrapper,
	});

async function setup(
	factors: unknown[],
	status = "needs_first_factor",
	secondFactors: unknown[] | null = null,
	user: object = {},
) {
	const session = {
		id: "sess_1",
		reload: jest.fn(),
		checkAuthorization: jest.fn(),
		startVerification: jest.fn(async () => ({
			status,
			supportedFirstFactors: factors,
			supportedSecondFactors: secondFactors,
		})),
		prepareFirstFactorVerification: jest.fn(async () => ({})),
		attemptFirstFactorVerification: jest.fn(
			async (): Promise<unknown> => ({ status: "complete" }),
		),
		prepareSecondFactorVerification: jest.fn(async () => ({})),
		attemptSecondFactorVerification: jest.fn(
			async (): Promise<unknown> => ({ status: "complete" }),
		),
	};
	const clerk = { user: { id: "user_1", ...user }, session };
	const hook = await renderHook(() => useReverify(clerk as never));
	const settled = jest.fn<void, [ReverifyOutcome]>();
	const rejected = jest.fn();
	await act(async () => {
		hook.result.current.verify(account).then(settled, rejected);
	});
	return { hook, clerk, session, settled, rejected };
}

beforeEach(() => jest.clearAllMocks());

describe("useReverify", () => {
	it("starts Clerk's verification at the level the deletion needs", async () => {
		const { session, hook, settled } = await setup([password]);
		expect(session.startVerification).toHaveBeenCalledWith({
			level: "second_factor",
		});
		expect(hook.result.current.method).toBe("password");
		expect(hook.result.current.email).toBeNull();
		expect(settled).not.toHaveBeenCalled();
	});

	it("verifies with the password and closes", async () => {
		const { session, hook, settled } = await setup([
			email("e1", true),
			password,
		]);
		expect(hook.result.current.method).toBe("password");
		expect(session.prepareFirstFactorVerification).not.toHaveBeenCalled();
		await act(() => hook.result.current.submit("secret"));
		expect(session.attemptFirstFactorVerification).toHaveBeenCalledWith({
			strategy: "password",
			password: "secret",
		});
		expect(settled).toHaveBeenCalledWith("verified");
		expect(hook.result.current.method).toBeNull();
	});

	it("emails a code to the primary address without a password, and verifies it", async () => {
		const { session, hook, settled } = await setup([
			email("e1", false),
			email("e2", true),
		]);
		expect(hook.result.current.method).toBe("code");
		expect(hook.result.current.email).toBe("e2@example.com");
		expect(session.prepareFirstFactorVerification).toHaveBeenCalledWith({
			strategy: "email_code",
			emailAddressId: "e2",
		});
		await act(() => hook.result.current.submit("424242"));
		expect(session.attemptFirstFactorVerification).toHaveBeenCalledWith({
			strategy: "email_code",
			code: "424242",
		});
		expect(settled).toHaveBeenCalledWith("verified");
	});

	it("switches from the password to a code and back without cancelling", async () => {
		const { session, hook, settled } = await setup([
			password,
			email("e1", true),
		]);
		expect(hook.result.current.hasPassword).toBe(true);
		await act(() => hook.result.current.sendCode());
		expect(hook.result.current.method).toBe("code");
		expect(session.prepareFirstFactorVerification).toHaveBeenCalledTimes(1);
		expect(hook.result.current.codeSent).toBe(false);
		await act(() => hook.result.current.sendCode());
		expect(hook.result.current.codeSent).toBe(true);

		await act(async () => hook.result.current.usePassword());
		expect(hook.result.current.method).toBe("password");
		expect(hook.result.current.codeSent).toBe(false);
		expect(hook.result.current.error).toBeNull();
		expect(settled).not.toHaveBeenCalled();

		await act(() => hook.result.current.submit("secret"));
		expect(session.attemptFirstFactorVerification).toHaveBeenCalledWith({
			strategy: "password",
			password: "secret",
		});
		expect(settled).toHaveBeenCalledWith("verified");
	});

	it("does not allow switching to password on a code-only account", async () => {
		const { hook } = await setup([email("e1", true)]);
		expect(hook.result.current.hasPassword).toBe(false);
		expect(hook.result.current.method).toBe("code");
		await act(async () => hook.result.current.usePassword());
		expect(hook.result.current.method).toBe("code");
	});

	it("clears a send error when returning to the password", async () => {
		const { session, hook } = await setup([password, email("e1", true)]);
		session.prepareFirstFactorVerification.mockRejectedValueOnce(
			refusal("too_many_requests"),
		);
		await act(() => hook.result.current.sendCode());
		expect(hook.result.current.errorKey).toBe("tooManyRequests");
		await act(async () => hook.result.current.usePassword());
		expect(hook.result.current.method).toBe("password");
		expect(hook.result.current.error).toBeNull();
	});

	it("ignores switching to password while a code is still sending", async () => {
		const { session, hook } = await setup([password, email("e1", true)]);
		let sent!: () => void;
		session.prepareFirstFactorVerification.mockReturnValueOnce(
			new Promise((resolve) => {
				sent = () => resolve({});
			}),
		);
		let pending!: Promise<void>;
		await act(async () => {
			pending = hook.result.current.sendCode();
		});
		expect(hook.result.current.sending).toBe(true);
		await act(async () => hook.result.current.usePassword());
		expect(hook.result.current.method).toBe("code");
		await act(async () => {
			sent();
			await pending;
		});
		expect(hook.result.current.sending).toBe(false);
		await act(async () => hook.result.current.usePassword());
		expect(hook.result.current.method).toBe("password");
	});

	it.each([
		[[password], "form_password_incorrect", "passwordIncorrect"],
		[[email("e1", true)], "form_code_incorrect", "codeIncorrect"],
		[[email("e1", true)], "verification_expired", "codeExpired"],
		[[password], "too_many_attempts", "tooManyRequests"],
		[
			[email("e1", true)],
			"verification_code_too_many_attempts",
			"codeAttemptsExceeded",
		],
		[[password], "user_locked", "accountLocked"],
	])(
		"keeps the sheet open on a wrong entry (%#)",
		async (factors, code, key) => {
			const { session, hook, settled } = await setup(factors);
			session.attemptFirstFactorVerification.mockRejectedValueOnce(
				refusal(code),
			);
			await act(() => hook.result.current.submit("000000"));
			expect(hook.result.current.errorKey).toBe(key);
			expect(hook.result.current.busy).toBe(false);
			expect(hook.result.current.method).not.toBeNull();
			expect(settled).not.toHaveBeenCalled();
			expect(reportError).not.toHaveBeenCalled();

			await act(() => hook.result.current.submit("111111"));
			expect(settled).toHaveBeenCalledWith("verified");
		},
	);

	it("keeps the lockout wait when Clerk locks the account", async () => {
		const { session, hook } = await setup([password]);
		session.attemptFirstFactorVerification.mockRejectedValueOnce(
			refusal("user_locked", { meta: { lockout_expires_in_seconds: 1800 } }),
		);
		await act(() => hook.result.current.submit("wrong"));
		expect(hook.result.current.error).toEqual({
			key: "accountLocked",
			lockoutSeconds: 1800,
		});
		expect(reportError).not.toHaveBeenCalled();
	});

	it.each([
		["authorization_invalid", "accountSignInFirst"],
		["session_reverification_required", "accountSignInFirst"],
		["session_not_found", "accountSessionEnded"],
		["authentication_invalid", "accountSessionEnded"],
	])(
		"closes on a session fault, %s, and rejects with %s",
		async (code, rejection) => {
			const { session, hook, settled, rejected } = await setup([password]);
			session.attemptFirstFactorVerification.mockRejectedValueOnce(
				refusal(code),
			);
			await act(() => hook.result.current.submit("secret"));
			expect(hook.result.current.method).toBeNull();
			expect(settled).not.toHaveBeenCalled();
			expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(rejection);
			expect(reportError).toHaveBeenCalledTimes(1);
		},
	);

	/** Clerk drops the user, then refuses with a code the app does not know. */
	const signedOut401 = (clerk: object) => async () => {
		Object.assign(clerk, { user: undefined, session: undefined });
		throw refusal("some_new_401", undefined, { status: 401 });
	};

	it("settles as a session end on an unmapped 401 that signed the phone out", async () => {
		const { clerk, session, hook, rejected } = await setup([password]);
		session.attemptFirstFactorVerification.mockImplementationOnce(
			signedOut401(clerk),
		);
		await act(() => hook.result.current.submit("secret"));
		expect(hook.result.current.method).toBeNull();
		expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
			"accountSessionEnded",
		);
		expect(reportError).toHaveBeenCalledTimes(1);
	});

	it("keeps the sheet open on the same unmapped 401 while still signed in", async () => {
		const { session, hook, rejected } = await setup([password]);
		session.attemptFirstFactorVerification.mockRejectedValueOnce(
			refusal("some_new_401", undefined, { status: 401 }),
		);
		await act(() => hook.result.current.submit("secret"));
		expect(hook.result.current.errorKey).toBe("generic");
		expect(rejected).not.toHaveBeenCalled();
	});

	it("says the session ended, not that the account changed, once signed out", async () => {
		const { clerk, hook, rejected } = await setup([password]);
		Object.assign(clerk, { user: null, session: null });
		await act(() => hook.result.current.submit("secret"));
		expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
			"accountSessionEnded",
		);
	});

	it("rejects when Clerk won't even start", async () => {
		const { session, hook } = await setup([password]);
		await act(async () => hook.result.current.cancel());
		session.startVerification.mockRejectedValueOnce(
			refusal("session_not_found"),
		);
		const caught = await hook.result.current
			.verify(account)
			.catch((error: unknown) => error);
		expect(gameErrorData(caught)?.code).toBe("accountSessionEnded");
		expect(hook.result.current.method).toBeNull();
	});

	it("maps HTTP 429 without a code to tooManyRequests without reporting", async () => {
		const { session, hook } = await setup([password]);
		session.attemptFirstFactorVerification.mockRejectedValueOnce({
			code: "api_response_error",
			status: 429,
			errors: [],
		});
		await act(() => hook.result.current.submit("wrong"));
		expect(hook.result.current.errorKey).toBe("tooManyRequests");
		expect(reportError).not.toHaveBeenCalled();
	});

	it("shows a code that could not be sent, with the sheet open to resend", async () => {
		const { session, hook } = await setup([password, email("e1", true)]);
		session.prepareFirstFactorVerification.mockRejectedValueOnce(
			refusal("too_many_requests"),
		);
		await act(() => hook.result.current.sendCode());
		expect(hook.result.current.errorKey).toBe("tooManyRequests");
		expect(hook.result.current.sending).toBe(false);
		await act(() => hook.result.current.sendCode());
		expect(hook.result.current.errorKey).toBeNull();
	});

	it("reports an unknown failure and shows the generic one", async () => {
		const { session, hook } = await setup([password]);
		session.attemptFirstFactorVerification.mockRejectedValueOnce(
			new Error("boom"),
		);
		await act(() => hook.result.current.submit("secret"));
		expect(hook.result.current.errorKey).toBe("generic");
		expect(reportError).toHaveBeenCalledTimes(1);
	});

	it("cancels, and a check that succeeds afterwards does not count", async () => {
		const { session, hook, settled } = await setup([password]);
		let finish!: (value: unknown) => void;
		session.attemptFirstFactorVerification.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			}),
		);
		let submitted!: Promise<void>;
		await act(async () => {
			submitted = hook.result.current.submit("secret");
		});
		expect(hook.result.current.busy).toBe(true);
		await act(async () => hook.result.current.cancel());
		await act(async () => {
			finish({ status: "complete" });
			await submitted;
		});
		expect(settled.mock.calls).toEqual([["cancelled"]]);
		expect(hook.result.current.method).toBeNull();
		expect(hook.result.current.busy).toBe(false);
	});

	it("cancels when the screen goes away", async () => {
		const { hook, settled } = await setup([password]);
		await hook.unmount();
		await act(async () => {});
		expect(settled).toHaveBeenCalledWith("cancelled");
	});

	it("cancels when the screen goes away before Clerk answers", async () => {
		const { hook, session, settled } = await setup([password]);
		await act(async () => hook.result.current.cancel());
		settled.mockClear();
		let answer!: (value: never) => void;
		session.startVerification.mockReturnValueOnce(
			new Promise((resolve) => {
				answer = resolve;
			}),
		);
		const outcome = hook.result.current.verify(account);
		await hook.unmount();
		answer({
			status: "needs_first_factor",
			supportedFirstFactors: [email("e1", true)],
		} as never);
		await expect(outcome).resolves.toBe("cancelled");
		expect(session.prepareFirstFactorVerification).not.toHaveBeenCalled();
	});

	it("is verified without a sheet when Clerk needs nothing more", async () => {
		const { hook, settled } = await setup([], "complete");
		expect(settled).toHaveBeenCalledWith("verified");
		expect(hook.result.current.method).toBeNull();
	});

	it.each([
		["no password or email code", [{ strategy: "passkey" }], undefined],
		["a status it doesn't know", [password], "needs_something_new"],
	])("is unsupported without a sheet: %s", async (_name, factors, status) => {
		const { hook, settled } = await setup(factors, status);
		expect(settled).toHaveBeenCalledWith("unsupported");
		expect(hook.result.current.method).toBeNull();
	});

	const totp = { strategy: "totp" };
	const phone = {
		strategy: "phone_code",
		phoneNumberId: "phone_1",
		safeIdentifier: "+1***55",
	};
	const backup = { strategy: "backup_code" };
	const passkey = { strategy: "passkey" };
	const secondStep = (factors: unknown[]) =>
		setup([], "needs_second_factor", factors);

	describe("second factor", () => {
		it.each([
			["totp", [totp, backup]],
			["backup_code", [backup]],
			["phone_code", [phone]],
		] as const)("verifies with %s", async (strategy, factors) => {
			const { session, hook, settled } = await secondStep([...factors]);
			expect(hook.result.current.method).toBe("secondFactor");
			await act(async () => {
				await hook.result.current.secondFactor?.actions.verify(
					strategy,
					"123456",
				);
			});
			expect(session.attemptSecondFactorVerification).toHaveBeenCalledWith({
				strategy,
				code: "123456",
			});
			expect(settled).toHaveBeenCalledWith("verified");
			expect(hook.result.current.method).toBeNull();
		});

		it("texts a code to the account's phone", async () => {
			const { session, hook } = await secondStep([phone]);
			await act(async () => {
				await hook.result.current.secondFactor?.actions.send("phone_code");
			});
			expect(session.prepareSecondFactorVerification).toHaveBeenCalledWith({
				strategy: "phone_code",
				phoneNumberId: "phone_1",
			});
		});

		it("follows the first factor when Clerk asks for both", async () => {
			const { session, hook, settled } = await setup([password]);
			session.attemptFirstFactorVerification.mockResolvedValueOnce({
				status: "needs_second_factor",
				supportedSecondFactors: [totp],
			});
			await act(() => hook.result.current.submit("secret"));
			expect(hook.result.current.method).toBe("secondFactor");
			expect(hook.result.current.busy).toBe(false);
			expect(settled).not.toHaveBeenCalled();
		});

		it("stays open on a wrong code without reporting it", async () => {
			const { session, hook, settled } = await secondStep([totp]);
			const wrong = refusal("form_code_incorrect");
			session.attemptSecondFactorVerification.mockRejectedValueOnce(wrong);
			let result: unknown;
			await act(async () => {
				result = await hook.result.current.secondFactor?.actions.verify(
					"totp",
					"000000",
				);
			});
			expect(result).toEqual({ error: wrong });
			expect(hook.result.current.method).toBe("secondFactor");
			expect(settled).not.toHaveBeenCalled();
			expect(reportError).not.toHaveBeenCalled();
		});

		it("closes when the session ended", async () => {
			const { session, hook, rejected } = await secondStep([totp]);
			session.attemptSecondFactorVerification.mockRejectedValueOnce(
				refusal("session_not_found"),
			);
			await act(async () => {
				await hook.result.current.secondFactor?.actions.verify("totp", "1");
			});
			expect(hook.result.current.method).toBeNull();
			expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
				"accountSessionEnded",
			);
		});

		it("does not count a code accepted after cancelling", async () => {
			const { session, hook, settled } = await secondStep([totp]);
			let finish!: (value: unknown) => void;
			session.attemptSecondFactorVerification.mockReturnValueOnce(
				new Promise((resolve) => {
					finish = resolve;
				}),
			);
			const pending = hook.result.current.secondFactor?.actions.verify(
				"totp",
				"123456",
			);
			await act(async () => hook.result.current.cancel());
			await act(async () => {
				finish({ status: "complete" });
				await pending;
			});
			expect(settled.mock.calls).toEqual([["cancelled"]]);
		});

		it.each([
			["before the code is checked", true],
			["while the code is checked", false],
		])("never verifies an account switched to %s", async (_name, before) => {
			const { clerk, session, hook, settled, rejected } = await secondStep([
				totp,
			]);
			session.attemptSecondFactorVerification.mockImplementationOnce(
				async () => {
					clerk.user.id = "user_2";
					return { status: "complete" };
				},
			);
			if (before) clerk.user.id = "user_2";
			await act(async () => {
				await hook.result.current.secondFactor?.actions.verify("totp", "1");
			});
			expect(session.attemptSecondFactorVerification).toHaveBeenCalledTimes(
				before ? 0 : 1,
			);
			expect(settled).not.toHaveBeenCalled();
			expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
				"accountChanged",
			);
		});

		it.each<[string, string, unknown[] | null, object]>([
			["straight away", "needs_second_factor", [passkey], {}],
			["no emailed code", "needs_second_factor", [email("e1", true)], {}],
			[
				"listed before the password",
				"needs_first_factor",
				[passkey],
				{ twoFactorEnabled: true },
			],
			[
				"not listed, on the user",
				"needs_first_factor",
				null,
				{ twoFactorEnabled: true },
			],
		])(
			"says nothing it can do helps, without a sheet: %s",
			async (_name, status, factors, user) => {
				const { hook, settled } = await setup(
					[password],
					status,
					factors,
					user,
				);
				expect(settled).toHaveBeenCalledWith("noSecondFactor");
				expect(hook.result.current.method).toBeNull();
			},
		);

		it("says so after the password only when Clerk didn't tell before", async () => {
			const { session, hook, settled } = await setup([password]);
			session.attemptFirstFactorVerification.mockResolvedValueOnce({
				status: "needs_second_factor",
				supportedSecondFactors: [passkey],
			});
			await act(() => hook.result.current.submit("secret"));
			expect(settled).toHaveBeenCalledWith("noSecondFactor");
		});

		it.each([
			{ totpEnabled: true },
			{ backupCodeEnabled: true },
			{ phoneNumbers: [{ reservedForSecondFactor: true }] },
		])("asks for the password first when the user has %j", async (user) => {
			const { hook } = await setup([password], "needs_first_factor", null, {
				twoFactorEnabled: true,
				...user,
			});
			expect(hook.result.current.method).toBe("password");
		});
	});

	it("never verifies another account that signed in meanwhile", async () => {
		const { clerk, session, hook, rejected } = await setup([password]);
		clerk.user.id = "user_2";
		await act(() => hook.result.current.submit("secret"));
		expect(session.attemptFirstFactorVerification).not.toHaveBeenCalled();
		expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
			"accountChanged",
		);
		expect(hook.result.current.method).toBeNull();
	});

	it("refuses an account switch during startVerification without opening or emailing", async () => {
		const { clerk, session, hook } = await setup([password]);
		await act(async () => hook.result.current.cancel());
		let answer!: (value: never) => void;
		session.startVerification.mockReturnValueOnce(
			new Promise((resolve) => {
				answer = resolve;
			}),
		);
		const outcome = hook.result.current.verify(account);
		clerk.user.id = "user_2";
		answer({
			status: "needs_first_factor",
			supportedFirstFactors: [email("e1", true)],
		} as never);
		const caught = await outcome.then(
			() => null,
			(error: unknown) => error,
		);
		expect(gameErrorData(caught)?.code).toBe("accountChanged");
		expect(hook.result.current.method).toBeNull();
		expect(session.prepareFirstFactorVerification).not.toHaveBeenCalled();
	});

	it("refuses an account switch during a pending verification attempt", async () => {
		const { clerk, session, hook, settled, rejected } = await setup([password]);
		let finish!: (value: unknown) => void;
		session.attemptFirstFactorVerification.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			}),
		);
		let submitted!: Promise<void>;
		await act(async () => {
			submitted = hook.result.current.submit("secret");
		});
		clerk.user.id = "user_2";
		await act(async () => {
			finish({ status: "complete" });
			await submitted;
		});
		expect(settled).not.toHaveBeenCalled();
		expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
			"accountChanged",
		);
		expect(hook.result.current.method).toBeNull();
	});

	it("refuses an account switch while sending a code", async () => {
		const { clerk, session, hook, settled, rejected } = await setup([
			password,
			email("e1", true),
		]);
		let sent!: () => void;
		session.prepareFirstFactorVerification.mockReturnValueOnce(
			new Promise((resolve) => {
				sent = () => resolve({});
			}),
		);
		let pending!: Promise<void>;
		await act(async () => {
			pending = hook.result.current.sendCode();
		});
		clerk.user.id = "user_2";
		await act(async () => {
			sent();
			await pending;
		});
		expect(settled).not.toHaveBeenCalled();
		expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
			"accountChanged",
		);
		expect(hook.result.current.method).toBeNull();
	});

	it("shows the lockout wait of a real ClerkAPIResponseError", async () => {
		const { session, hook } = await setup([password]);
		// Clerk sends `meta.lockout_expires_in_seconds` too, but the SDK's error
		// type has no such field and drops it: the wait survives only in the text.
		session.attemptFirstFactorVerification.mockRejectedValueOnce(
			new ClerkAPIResponseError("Locked", {
				status: 422,
				data: [
					{
						code: "user_locked",
						message: "Account locked",
						long_message:
							"Your account is locked. You will be able to try again in 30 minutes.",
					},
				],
			}),
		);
		await act(() => hook.result.current.submit("wrong"));
		expect(hook.result.current.error).toEqual({
			key: "accountLocked",
			lockoutSeconds: 1800,
		});
		expect(
			authErrorMessage(messages.en, "en", hook.result.current.error),
		).toContain("30 minutes");
		expect(reportError).not.toHaveBeenCalled();
	});

	it("ignores 'Use my password' that lands with Cancel, before a rerender", async () => {
		const { hook, settled } = await setup([password, email("e1", true)]);
		await act(() => hook.result.current.sendCode());
		expect(hook.result.current.method).toBe("code");
		// Both calls hold the render from before Cancel.
		const stale = hook.result.current;
		await act(async () => {
			stale.cancel();
			stale.usePassword();
		});
		expect(settled).toHaveBeenCalledWith("cancelled");
		expect(hook.result.current.method).toBeNull();
		expect(hook.result.current.hasPassword).toBe(false);
	});

	it("ignores 'Email me a code' that lands with Cancel, before a rerender", async () => {
		const { hook, session } = await setup([password, email("e1", true)]);
		const stale = hook.result.current;
		await act(async () => {
			stale.cancel();
			void stale.sendCode();
		});
		expect(hook.result.current.method).toBeNull();
		expect(session.prepareFirstFactorVerification).not.toHaveBeenCalled();
	});

	describe("overlapping verify calls", () => {
		it("share one Clerk verification and one result", async () => {
			const { session, hook, settled } = await setup([password]);
			const again = jest.fn<void, [ReverifyOutcome]>();
			await act(async () => {
				hook.result.current.verify(account).then(again);
			});
			expect(session.startVerification).toHaveBeenCalledTimes(1);
			await act(() => hook.result.current.submit("secret"));
			expect(settled.mock.calls).toEqual([["verified"]]);
			expect(again.mock.calls).toEqual([["verified"]]);
		});

		it("share a rejection too", async () => {
			const { session, hook, rejected } = await setup([password]);
			const again = jest.fn();
			await act(async () => {
				hook.result.current.verify(account).then(undefined, again);
			});
			session.attemptFirstFactorVerification.mockRejectedValueOnce(
				refusal("session_not_found"),
			);
			await act(() => hook.result.current.submit("secret"));
			expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
				"accountSessionEnded",
			);
			expect(again.mock.calls[0]?.[0]).toBe(rejected.mock.calls[0]?.[0]);
			expect(reportError).toHaveBeenCalledTimes(1);
		});

		it("share the call that is still starting", async () => {
			const { session, hook } = await setup([password]);
			await act(async () => hook.result.current.cancel());
			session.startVerification.mockClear();
			let answer!: (value: never) => void;
			session.startVerification.mockReturnValueOnce(
				new Promise((resolve) => {
					answer = resolve;
				}),
			);
			const first = hook.result.current.verify(account);
			const second = hook.result.current.verify(account);
			await act(async () => {
				answer({ status: "complete" } as never);
			});
			await expect(first).resolves.toBe("verified");
			await expect(second).resolves.toBe("verified");
			expect(session.startVerification).toHaveBeenCalledTimes(1);
		});

		it("start afresh in the same tick the first one settles", async () => {
			const { session, hook } = await setup([password]);
			session.startVerification.mockClear();
			await act(async () => {
				hook.result.current.cancel();
				void hook.result.current.verify(account);
			});
			expect(session.startVerification).toHaveBeenCalledTimes(1);
			expect(hook.result.current.method).toBe("password");
		});

		it("start a fresh verification once the first one is done", async () => {
			const { session, hook } = await setup([password]);
			await act(() => hook.result.current.submit("secret"));
			session.startVerification.mockClear();
			await act(async () => {
				void hook.result.current.verify(account);
			});
			expect(session.startVerification).toHaveBeenCalledTimes(1);
			expect(hook.result.current.method).toBe("password");
		});
	});

	describe("with a password the caller already has", () => {
		async function verifyWith(
			hook: Awaited<ReturnType<typeof setup>>["hook"],
			value = "typed",
		) {
			const settled = jest.fn<void, [ReverifyOutcome]>();
			const rejected = jest.fn();
			await act(async () => {
				hook.result.current
					.verify(account, { password: value })
					.then(settled, rejected);
			});
			return { settled, rejected };
		}

		async function start(factors: unknown[], second: unknown[] | null = null) {
			const made = await setup(factors, "needs_first_factor", second);
			await act(async () => made.hook.result.current.cancel());
			made.session.startVerification.mockClear();
			return made;
		}

		it("verifies with it and never opens the sheet", async () => {
			const { session, hook } = await start([password]);
			const { settled } = await verifyWith(hook);
			expect(session.attemptFirstFactorVerification).toHaveBeenCalledWith({
				strategy: "password",
				password: "typed",
			});
			expect(settled).toHaveBeenCalledWith("verified");
			expect(hook.result.current.method).toBeNull();
		});

		it("goes on to the second step without asking for the password again", async () => {
			const { session, hook } = await start([password], [totp]);
			session.attemptFirstFactorVerification.mockResolvedValueOnce({
				status: "needs_second_factor",
				supportedSecondFactors: [totp],
			});
			const { settled } = await verifyWith(hook);
			expect(hook.result.current.method).toBe("secondFactor");
			expect(settled).not.toHaveBeenCalled();
			await act(async () => {
				await hook.result.current.secondFactor?.actions.verify(
					"totp",
					"123456",
				);
			});
			expect(settled).toHaveBeenCalledWith("verified");
			expect(session.attemptFirstFactorVerification).toHaveBeenCalledTimes(1);
		});

		it("hands a wrong password back to the caller instead of asking again in the sheet", async () => {
			const { session, hook } = await start([password]);
			const wrong = refusal("form_password_incorrect");
			session.attemptFirstFactorVerification.mockRejectedValueOnce(wrong);
			const { settled, rejected } = await verifyWith(hook);
			expect(hook.result.current.method).toBeNull();
			expect(settled).not.toHaveBeenCalled();
			expect(rejected).toHaveBeenCalledWith(wrong);
			expect(session.attemptFirstFactorVerification).toHaveBeenCalledTimes(1);
			expect(reportError).not.toHaveBeenCalled();
		});

		it("keeps the lockout wait when that password locks the account", async () => {
			const { session, hook } = await start([password]);
			session.attemptFirstFactorVerification.mockRejectedValueOnce(
				refusal("user_locked", { meta: { lockout_expires_in_seconds: 600 } }),
			);
			await verifyWith(hook);
			expect(hook.result.current.error).toEqual({
				key: "accountLocked",
				lockoutSeconds: 600,
			});
		});

		it("closes and rejects when the session ended", async () => {
			const { session, hook } = await start([password]);
			session.attemptFirstFactorVerification.mockRejectedValueOnce(
				refusal("session_not_found"),
			);
			const { settled, rejected } = await verifyWith(hook);
			expect(hook.result.current.method).toBeNull();
			expect(settled).not.toHaveBeenCalled();
			expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
				"accountSessionEnded",
			);
		});

		it("ignores it for an account without a password, which gets the emailed code", async () => {
			const { session, hook } = await start([email("e1", true)]);
			await verifyWith(hook);
			expect(session.attemptFirstFactorVerification).not.toHaveBeenCalled();
			expect(hook.result.current.method).toBe("code");
		});

		it("never confirms another account that signed in meanwhile", async () => {
			const { clerk, session, hook } = await start([password]);
			session.attemptFirstFactorVerification.mockImplementationOnce(
				async () => {
					clerk.user.id = "user_2";
					return { status: "complete" };
				},
			);
			const { settled, rejected } = await verifyWith(hook);
			expect(settled).not.toHaveBeenCalled();
			expect(gameErrorData(rejected.mock.calls[0]?.[0])?.code).toBe(
				"accountChanged",
			);
		});
	});

	describe("a session that ended after the screen was gone", () => {
		const unseen = jest.fn();

		async function openThenUnmount() {
			const session = {
				id: "sess_1",
				startVerification: jest.fn(async () => ({
					status: "needs_first_factor",
					supportedFirstFactors: [password],
				})),
				attemptFirstFactorVerification: jest.fn(),
			};
			const clerk = { user: { id: "user_1" }, session };
			const hook = await renderHook(() => useReverify(clerk as never, unseen));
			await act(async () => {
				hook.result.current.verify(account);
			});
			return { clerk, hook, session };
		}

		beforeEach(() => unseen.mockClear());

		it("is handed over for an alert, once", async () => {
			const { hook, session } = await openThenUnmount();
			let reject!: (reason: unknown) => void;
			session.attemptFirstFactorVerification.mockReturnValueOnce(
				new Promise((_resolve, fail) => {
					reject = fail;
				}),
			);
			await act(async () => {
				void hook.result.current.submit("secret");
			});
			await hook.unmount();
			await act(async () => {
				reject(refusal("session_not_found"));
			});
			expect(unseen).toHaveBeenCalledTimes(1);
			expect(gameErrorData(unseen.mock.calls[0]?.[0])?.code).toBe(
				"accountSessionEnded",
			);
		});

		it("is announced for an unmapped 401 that signed the phone out", async () => {
			const { clerk, hook, session } = await openThenUnmount();
			let late!: () => void;
			session.attemptFirstFactorVerification.mockReturnValueOnce(
				new Promise<void>((resolve) => {
					late = resolve;
				}).then(signedOut401(clerk)),
			);
			await act(async () => {
				void hook.result.current.submit("secret");
			});
			await hook.unmount();
			await act(async () => late());
			expect(gameErrorData(unseen.mock.calls[0]?.[0])?.code).toBe(
				"accountSessionEnded",
			);
		});

		it("is not announced when it lands after Cancel and then leaving", async () => {
			const { hook, session } = await openThenUnmount();
			let reject!: (reason: unknown) => void;
			session.attemptFirstFactorVerification.mockReturnValueOnce(
				new Promise((_resolve, fail) => {
					reject = fail;
				}),
			);
			await act(async () => {
				void hook.result.current.submit("secret");
			});
			await act(async () => hook.result.current.cancel());
			await hook.unmount();
			await act(async () => {
				reject(refusal("session_not_found"));
			});
			expect(unseen).not.toHaveBeenCalled();
		});

		it("is not announced for a wrong entry or after cancelling", async () => {
			const { hook, session } = await openThenUnmount();
			let reject!: (reason: unknown) => void;
			session.attemptFirstFactorVerification.mockReturnValueOnce(
				new Promise((_resolve, fail) => {
					reject = fail;
				}),
			);
			await act(async () => {
				void hook.result.current.submit("secret");
			});
			await act(async () => hook.result.current.cancel());
			await act(async () => {
				reject(refusal("session_not_found"));
			});
			expect(unseen).not.toHaveBeenCalled();
		});
	});
});
