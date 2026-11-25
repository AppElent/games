// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ok = { error: null };
const signIn = {
	status: "needs_second_factor",
	supportedSecondFactors: [] as { strategy: string; safeIdentifier?: string }[],
	finalize: vi.fn(),
	reset: vi.fn(),
	mfa: {
		sendPhoneCode: vi.fn(),
		sendEmailCode: vi.fn(),
		verifyTOTP: vi.fn(),
		verifyPhoneCode: vi.fn(),
		verifyEmailCode: vi.fn(),
		verifyBackupCode: vi.fn(),
	},
};
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn }) }));

import { type Locale, LocaleProvider } from "#/lib/i18n";
import { SecondFactorStep } from "../SecondFactorStep";

const refused = (code: string) => ({
	error: { errors: [{ code, message: "Raw Clerk English" }] },
});
const complete = async () => {
	signIn.status = "complete";
	return ok;
};

function renderStep(locale: Locale = "en") {
	const onSuccess = vi.fn();
	const onBack = vi.fn();
	render(
		<StrictMode>
			<LocaleProvider initialLocale={locale}>
				<SecondFactorStep onSuccess={onSuccess} onBack={onBack} />
			</LocaleProvider>
		</StrictMode>,
	);
	return { onSuccess, onBack };
}

function enter(label: string, value: string, submit = "Verify") {
	fireEvent.change(screen.getByLabelText(label), { target: { value } });
	fireEvent.click(screen.getByRole("button", { name: submit }));
}

describe("SecondFactorStep", () => {
	beforeEach(() => {
		signIn.status = "needs_second_factor";
		signIn.supportedSecondFactors = [
			{ strategy: "backup_code" },
			{ strategy: "totp" },
		];
		signIn.finalize.mockResolvedValue(ok);
		signIn.reset.mockResolvedValue(ok);
		signIn.mfa.sendEmailCode.mockResolvedValue(ok);
	});

	afterEach(() => {
		cleanup();
		for (const fn of [
			signIn.finalize,
			signIn.reset,
			...Object.values(signIn.mfa),
		]) {
			fn.mockReset();
		}
	});

	it("signs in with an authenticator code", async () => {
		signIn.mfa.verifyTOTP.mockImplementation(complete);
		const { onSuccess } = renderStep();
		const field = screen.getByLabelText("Code");
		expect(document.activeElement).toBe(field);
		expect(field.getAttribute("autocomplete")).toBe("one-time-code");
		expect(field.getAttribute("inputmode")).toBe("numeric");
		expect(
			document.getElementById(field.getAttribute("aria-describedby") ?? "")
				?.textContent,
		).toBe("Enter the 6-digit code from your authenticator app.");
		expect(
			screen.getByRole("button", { name: "Verify" }).hasAttribute("disabled"),
		).toBe(true);
		enter("Code", "123 456");
		await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
		expect(signIn.mfa.verifyTOTP).toHaveBeenCalledWith({ code: "123456" });
		expect(signIn.finalize).toHaveBeenCalledTimes(1);
	});

	it("shows a wrong code by the field, in Dutch, and takes another", async () => {
		signIn.mfa.verifyTOTP.mockResolvedValue(refused("form_code_incorrect"));
		const { onSuccess } = renderStep("nl");
		enter("Code", "000000", "Bevestigen");
		const alert = await screen.findByRole("alert");
		expect(alert.textContent).toBe("Die code klopt niet.");
		const field = screen.getByLabelText("Code");
		expect(field.getAttribute("aria-invalid")).toBe("true");
		expect(field.getAttribute("aria-describedby")).toContain(alert.id);
		expect((field as HTMLInputElement).value).toBe("000000");
		await vi.waitFor(() => expect(document.activeElement).toBe(field));
		expect(signIn.finalize).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("says how long a locked account has to wait", async () => {
		signIn.mfa.verifyTOTP.mockResolvedValue({
			error: {
				errors: [
					{ code: "user_locked", meta: { lockout_expires_in_seconds: 600 } },
				],
			},
		});
		renderStep();
		enter("Code", "000000");
		expect((await screen.findByRole("alert")).textContent).toContain(
			"Try again in 10 minutes.",
		);
	});

	it("signs in with a backup code", async () => {
		signIn.mfa.verifyBackupCode.mockImplementation(complete);
		const { onSuccess } = renderStep();
		fireEvent.click(screen.getByRole("button", { name: "Use a backup code" }));
		const field = await screen.findByLabelText("Backup code");
		expect(field.getAttribute("autocomplete")).toBe("off");
		await vi.waitFor(() => expect(document.activeElement).toBe(field));
		enter("Backup code", "ab12cd34");
		await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
		expect(signIn.mfa.verifyBackupCode).toHaveBeenCalledWith({
			code: "ab12cd34",
		});
	});

	it("drops a locked method's field and leaves the other one", async () => {
		signIn.mfa.verifyTOTP.mockResolvedValue(refused("verification_failed"));
		renderStep();
		enter("Code", "000000");
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Too many wrong codes for this method. Use another one below, or go back and sign in again.",
		);
		expect(screen.queryByLabelText("Code")).toBeNull();
		await vi.waitFor(() =>
			expect(document.activeElement?.textContent).toContain(
				"Too many wrong codes",
			),
		);
		fireEvent.click(screen.getByRole("button", { name: "Use a backup code" }));
		expect(await screen.findByLabelText("Backup code")).toBeDefined();
	});

	it("emails a code once, and again when asked", async () => {
		signIn.supportedSecondFactors = [
			{ strategy: "email_code", safeIdentifier: "a***@b.com" },
		];
		renderStep();
		expect(
			screen.getByText("We sent a 6-digit code to a***@b.com."),
		).toBeDefined();
		await vi.waitFor(() =>
			expect(signIn.mfa.sendEmailCode).toHaveBeenCalledTimes(1),
		);
		const resend = await screen.findByRole("button", {
			name: "Send a new code",
		});
		fireEvent.click(resend);
		await vi.waitFor(() =>
			expect(screen.getByRole("status").textContent).toBe(
				"A new code is on its way.",
			),
		);
		expect(signIn.mfa.sendEmailCode).toHaveBeenCalledTimes(2);
	});

	it("says what to do when the account only has a factor we can't handle", () => {
		signIn.supportedSecondFactors = [{ strategy: "passkey" }];
		const { onBack } = renderStep();
		expect(screen.getByRole("alert").textContent).toContain(
			"privacy@appelent.nl",
		);
		expect(screen.queryByRole("textbox")).toBeNull();
		expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
		return vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
	});

	it("drops the attempt on the way back, even when that fails", async () => {
		signIn.reset.mockRejectedValue(new Error("offline"));
		const { onBack } = renderStep();
		fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
		await vi.waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
		expect(signIn.reset).toHaveBeenCalled();
	});
});
