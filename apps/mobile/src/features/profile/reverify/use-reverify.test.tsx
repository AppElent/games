import { gameErrorData } from "@arcadeclub/core/errors";
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
const refusal = (code: string) =>
	Object.assign(new Error("Raw Clerk English"), {
		code: "api_response_error",
		errors: [{ code, message: "Raw Clerk English" }],
	});

async function setup(factors: unknown[], status = "needs_first_factor") {
	const session = {
		id: "sess_1",
		reload: jest.fn(),
		checkAuthorization: jest.fn(),
		startVerification: jest.fn(async () => ({
			status,
			supportedFirstFactors: factors,
		})),
		prepareFirstFactorVerification: jest.fn(async () => ({})),
		attemptFirstFactorVerification: jest.fn(
			async (): Promise<unknown> => ({ status: "complete" }),
		),
	};
	const clerk = { user: { id: "user_1" }, session };
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

	it("switches from the password to a code", async () => {
		const { session, hook } = await setup([password, email("e1", true)]);
		await act(() => hook.result.current.sendCode());
		expect(hook.result.current.method).toBe("code");
		expect(session.prepareFirstFactorVerification).toHaveBeenCalledTimes(1);
		expect(hook.result.current.codeSent).toBe(false);
		await act(() => hook.result.current.sendCode());
		expect(hook.result.current.codeSent).toBe(true);
	});

	it.each([
		[[password], "form_password_incorrect", "passwordIncorrect"],
		[[email("e1", true)], "form_code_incorrect", "codeIncorrect"],
		[[email("e1", true)], "verification_expired", "codeExpired"],
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
		["a second factor", [password], "needs_second_factor"],
	])("is unsupported without a sheet: %s", async (_name, factors, status) => {
		const { hook, settled } = await setup(factors, status);
		expect(settled).toHaveBeenCalledWith("unsupported");
		expect(hook.result.current.method).toBeNull();
	});

	it("is unsupported when Clerk wants a second factor after the first", async () => {
		const { session, hook, settled } = await setup([password]);
		session.attemptFirstFactorVerification.mockResolvedValueOnce({
			status: "needs_second_factor",
		});
		await act(() => hook.result.current.submit("secret"));
		expect(settled).toHaveBeenCalledWith("unsupported");
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
});
