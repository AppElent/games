import { describe, expect, it, vi } from "vitest";
import { messages } from "../messages";
import {
	createSecondFactorFlow,
	needsSecondFactor,
	type SecondFactorResult,
	secondFactorInput,
	secondFactorMessage,
	secondFactorOpen,
	secondFactorOptions,
	secondFactorPrompt,
	secondFactorSwitchLabel,
	signInSecondFactor,
} from "../second-factor";

const ok: SecondFactorResult = { error: null };
// The real shape: Clerk's wrapper code on top, the API code inside.
const refused = (code: string, extra?: object): SecondFactorResult => ({
	error: { code: "api_response_error", errors: [{ code, ...extra }] },
});
const TOTP = { strategy: "totp" };
const BACKUP = { strategy: "backup_code" };
const EMAIL = { strategy: "email_code", safeIdentifier: "a***@b.com" };
const PHONE = { strategy: "phone_code", safeIdentifier: "+1*******55" };
const copy = messages.en.auth.secondFactor;

function setup(
	factors: { strategy: string; safeIdentifier?: string }[],
	verifyResult: SecondFactorResult = ok,
) {
	const actions = {
		send: vi.fn(async () => ok),
		verify: vi.fn(async () => verifyResult),
	};
	const flow = createSecondFactorFlow(factors, actions);
	const message = (locale: "en" | "nl" = "en") =>
		secondFactorMessage(messages[locale], locale, flow.getState());
	return { flow, actions, message };
}

describe("second factor helpers", () => {
	it("recognizes both statuses that want a second step", () => {
		expect(needsSecondFactor("needs_second_factor")).toBe(true);
		expect(needsSecondFactor("needs_client_trust")).toBe(true);
		expect(needsSecondFactor("complete")).toBe(false);
		expect(needsSecondFactor(null)).toBe(false);
	});

	it("offers what we can handle, default first, one per method", () => {
		expect(
			secondFactorOptions([
				BACKUP,
				{ strategy: "passkey" },
				EMAIL,
				PHONE,
				{ strategy: "phone_code", safeIdentifier: "+1*******66" },
				TOTP,
			]),
		).toEqual([TOTP, PHONE, EMAIL, BACKUP]);
		expect(secondFactorOptions(null)).toEqual([]);
	});

	it("keeps six digits of a code and all of a backup code", () => {
		expect(secondFactorInput("totp", "123 456-7")).toBe("123456");
		expect(secondFactorInput("backup_code", "ab12-cd34")).toBe("ab12-cd34");
	});

	it("names where a code went, also without a masked address", () => {
		expect(
			secondFactorPrompt(messages.nl, { strategy: "phone_code" }),
		).toContain("je telefoon");
		expect(
			secondFactorSwitchLabel(messages.en, {
				strategy: "email_code",
				safeIdentifier: "a***@b.com",
			}),
		).toBe("Email a code to a***@b.com");
	});
});

describe("createSecondFactorFlow", () => {
	it("verifies a trimmed code and stays busy while the screen leaves", async () => {
		const { flow, actions } = setup([BACKUP]);
		flow.start();
		expect(actions.send).not.toHaveBeenCalled();
		expect(await flow.verify("  ab12cd34 ")).toBe(true);
		expect(actions.verify).toHaveBeenCalledWith("backup_code", "ab12cd34");
		expect(flow.getState().busy).toBe("verify");
	});

	it("does not send an incomplete code", async () => {
		const { flow, actions } = setup([TOTP]);
		expect(await flow.verify("123")).toBe(false);
		expect(actions.verify).not.toHaveBeenCalled();
	});

	it("verifies once at a time", async () => {
		const { flow, actions } = setup([TOTP]);
		const both = [flow.verify("123456"), flow.verify("123456")];
		expect(await Promise.all(both)).toEqual([true, false]);
		expect(actions.verify).toHaveBeenCalledTimes(1);
	});

	it.each([
		["form_code_incorrect", "That code is not right.", "Die code klopt niet."],
		[
			"too_many_requests",
			"Too many attempts. Try again in a moment.",
			"Te veel pogingen. Probeer het zo opnieuw.",
		],
		[
			"something_new",
			"Something went wrong. Please try again.",
			"Er ging iets mis. Probeer het opnieuw.",
		],
	])("translates %s and takes another code", async (code, en, nl) => {
		const { flow, message } = setup(
			[TOTP],
			refused(code, { message: "Raw Clerk English" }),
		);
		expect(await flow.verify("000000")).toBe(false);
		expect(message()).toBe(en);
		expect(message("nl")).toBe(nl);
		expect(secondFactorOpen(flow.getState())).toBe(true);
		expect(flow.getState().busy).toBeNull();
	});

	it("says how long a locked account has to wait", async () => {
		const { flow, message } = setup(
			[TOTP],
			refused("user_locked", { meta: { lockout_expires_in_seconds: 1800 } }),
		);
		await flow.verify("000000");
		expect(message()).toContain("Try again in 30 minutes.");
	});

	it("shows translated copy when a call throws", async () => {
		const { flow, actions, message } = setup([TOTP]);
		actions.verify.mockRejectedValue(new Error("Raw Clerk English"));
		expect(await flow.verify("123456")).toBe(false);
		expect(message()).toBe("Something went wrong. Please try again.");
	});

	it("locks only the method with too many wrong codes", async () => {
		const { flow, actions, message } = setup(
			[TOTP, BACKUP],
			refused("verification_failed"),
		);
		await flow.verify("000000");
		expect(secondFactorOpen(flow.getState())).toBe(false);
		expect(message()).toBe(copy.methodLocked);
		expect(await flow.verify("123456")).toBe(false);
		expect(actions.verify).toHaveBeenCalledTimes(1);

		expect(await flow.switchTo("backup_code")).toBe(true);
		expect(message()).toBeNull();
		expect(secondFactorOpen(flow.getState())).toBe(true);
		await flow.verify("ab12cd34");
		expect(message()).toBe(copy.onlyMethodLocked);
		// Still locked, and still saying so, on the way back.
		await flow.switchTo("totp");
		expect(message()).toBe(copy.onlyMethodLocked);
	});

	it("unlocks an emailed code with a new one", async () => {
		const { flow, message } = setup([EMAIL], refused("verification_failed"));
		await flow.verify("000000");
		expect(secondFactorOpen(flow.getState())).toBe(false);
		expect(message()).toBe("Too many wrong codes. Send a new one.");
		expect(await flow.resend()).toBe(true);
		expect(secondFactorOpen(flow.getState())).toBe(true);
		expect(flow.getState().resent).toBe(true);
		expect(message()).toBeNull();
	});

	it("sends the default method's code once", async () => {
		const { flow, actions } = setup([EMAIL]);
		flow.start();
		flow.start();
		await vi.waitFor(() => expect(flow.getState().busy).toBeNull());
		expect(actions.send.mock.calls).toEqual([["email_code"]]);
		expect(flow.getState().resent).toBe(false);
	});

	it("sends a code before switching, and stays when that fails", async () => {
		const { flow, actions, message } = setup([TOTP, PHONE]);
		actions.send.mockResolvedValueOnce(refused("too_many_requests"));
		expect(await flow.switchTo("phone_code")).toBe(false);
		expect(flow.getState().strategy).toBe("totp");
		expect(message()).toBe("Too many attempts. Try again in a moment.");
		expect(await flow.switchTo("phone_code")).toBe(true);
		expect(flow.getState().strategy).toBe("phone_code");
		expect(message()).toBeNull();
	});

	it.each(["resource_not_found", "sign_in_expired"])(
		"ends an attempt Clerk dropped (%s)",
		async (code) => {
			const { flow, actions, message } = setup([TOTP, EMAIL], refused(code));
			await flow.verify("123456");
			expect(message()).toBe(copy.attemptEnded);
			expect(secondFactorOpen(flow.getState())).toBe(false);
			expect(await flow.switchTo("email_code")).toBe(false);
			expect(actions.send).not.toHaveBeenCalled();
		},
	);

	it("says what to do when no method is one we handle", async () => {
		const { flow, actions, message } = setup([{ strategy: "passkey" }]);
		flow.start();
		expect(message()).toBe(copy.noMethod);
		expect(message("nl")).toBe(messages.nl.auth.secondFactor.noMethod);
		expect(secondFactorOpen(flow.getState())).toBe(false);
		expect(await flow.verify("123456")).toBe(false);
		expect(actions.verify).not.toHaveBeenCalled();
	});

	it("tells subscribers until they leave", async () => {
		const { flow } = setup([TOTP, BACKUP]);
		const listener = vi.fn();
		const leave = flow.subscribe(listener);
		await flow.switchTo("backup_code");
		expect(listener).toHaveBeenCalledTimes(1);
		leave();
		await flow.switchTo("totp");
		expect(listener).toHaveBeenCalledTimes(1);
	});
});

describe("signInSecondFactor", () => {
	function clerk(after = "complete") {
		const signIn = {
			status: "needs_second_factor",
			finalize: vi.fn(async () => ok),
			mfa: {
				sendPhoneCode: vi.fn(async () => ok),
				sendEmailCode: vi.fn(async () => ok),
				verifyTOTP: vi.fn(),
				verifyPhoneCode: vi.fn(),
				verifyEmailCode: vi.fn(),
				verifyBackupCode: vi.fn(),
			},
		};
		const verified = async () => {
			signIn.status = after;
			return ok;
		};
		signIn.mfa.verifyTOTP.mockImplementation(verified);
		signIn.mfa.verifyPhoneCode.mockImplementation(verified);
		signIn.mfa.verifyEmailCode.mockImplementation(verified);
		signIn.mfa.verifyBackupCode.mockImplementation(verified);
		return { signIn, actions: signInSecondFactor(() => signIn) };
	}

	it.each([
		["totp", "verifyTOTP"],
		["phone_code", "verifyPhoneCode"],
		["email_code", "verifyEmailCode"],
		["backup_code", "verifyBackupCode"],
	] as const)("verifies %s, then activates the session", async (s, method) => {
		const { signIn, actions } = clerk();
		expect(await actions.verify(s, "123456")).toBe(ok);
		expect(signIn.mfa[method]).toHaveBeenCalledWith({ code: "123456" });
		expect(signIn.finalize).toHaveBeenCalledTimes(1);
	});

	it("sends the code of the method asked for", async () => {
		const { signIn, actions } = clerk();
		await actions.send("phone_code");
		expect(signIn.mfa.sendPhoneCode).toHaveBeenCalledTimes(1);
		expect(signIn.mfa.sendEmailCode).not.toHaveBeenCalled();
		await actions.send("email_code");
		expect(signIn.mfa.sendEmailCode).toHaveBeenCalledTimes(1);
	});

	it("never activates after a refused code", async () => {
		const { signIn, actions } = clerk();
		const refusal = refused("form_code_incorrect");
		signIn.mfa.verifyTOTP.mockResolvedValue(refusal);
		expect(await actions.verify("totp", "000000")).toBe(refusal);
		expect(signIn.finalize).not.toHaveBeenCalled();
	});

	it("does not spend a second code when only activating failed", async () => {
		const { signIn, actions } = clerk();
		signIn.finalize.mockResolvedValueOnce(refused("network_error"));
		expect((await actions.verify("backup_code", "ab12")).error).toBeTruthy();
		expect(await actions.verify("backup_code", "ab12")).toBe(ok);
		expect(signIn.mfa.verifyBackupCode).toHaveBeenCalledTimes(1);
	});

	it("says so when Clerk wants yet another step", async () => {
		const { signIn, actions } = clerk("needs_new_password");
		const flow = createSecondFactorFlow([TOTP], actions);
		await flow.verify("123456");
		expect(signIn.finalize).not.toHaveBeenCalled();
		expect(secondFactorMessage(messages.en, "en", flow.getState())).toBe(
			messages.en.auth.errors.unsupportedStep,
		);
	});
});
