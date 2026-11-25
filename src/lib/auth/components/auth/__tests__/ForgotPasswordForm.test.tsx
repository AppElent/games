// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ok = { error: null };
const signIn = {
	id: undefined as string | undefined,
	status: null as string | null,
	secondFactorVerification: { strategy: null as string | null },
	create: vi.fn(),
	finalize: vi.fn(),
	reset: vi.fn(),
	supportedSecondFactors: [{ strategy: "totp" }],
	mfa: { verifyTOTP: vi.fn() },
	resetPasswordEmailCode: {
		sendCode: vi.fn(),
		verifyCode: vi.fn(),
		submitPassword: vi.fn(),
	},
};
vi.mock("@clerk/react", () => ({
	useSignIn: () => ({ signIn }),
	useAuth: () => ({ isLoaded: true }),
}));

import { type Locale, LocaleProvider } from "#/lib/i18n";
import { AuthConfigProvider } from "../AuthConfigProvider";
import { ForgotPasswordForm } from "../ForgotPasswordForm";

function renderForm(
	onSuccess = vi.fn(),
	locale: Locale = "en",
	onBackToSignIn = vi.fn(),
) {
	return render(
		<LocaleProvider initialLocale={locale}>
			<AuthConfigProvider>
				<ForgotPasswordForm
					onSuccess={onSuccess}
					onBackToSignIn={onBackToSignIn}
				/>
			</AuthConfigProvider>
		</LocaleProvider>,
	);
}

describe("ForgotPasswordForm", () => {
	afterEach(() => {
		cleanup();
		signIn.status = null;
		signIn.id = undefined;
		signIn.secondFactorVerification.strategy = null;
		sessionStorage.clear();
		window.history.replaceState(null, "", "/");
		for (const m of [
			signIn.create,
			signIn.finalize,
			...Object.values(signIn.resetPasswordEmailCode),
		])
			m.mockReset();
	});

	it("requests a reset code then sets a new password", async () => {
		signIn.create.mockResolvedValue(ok);
		signIn.resetPasswordEmailCode.sendCode.mockResolvedValue(ok);
		signIn.resetPasswordEmailCode.verifyCode.mockResolvedValue(ok);
		signIn.resetPasswordEmailCode.submitPassword.mockImplementation(
			async () => {
				signIn.status = "complete";
				return ok;
			},
		);
		signIn.finalize.mockResolvedValue(ok);
		const onSuccess = vi.fn();
		renderForm(onSuccess);

		expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe(
			"username",
		);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send code/i }));
		await vi.waitFor(() =>
			expect(signIn.resetPasswordEmailCode.sendCode).toHaveBeenCalled(),
		);
		expect(signIn.create).toHaveBeenCalledWith({ identifier: "a@b.com" });

		const form = (await screen.findByLabelText("Code")).closest("form");
		const hint = form?.querySelector<HTMLInputElement>(
			'input[autocomplete="username"]',
		);
		expect(hint?.value).toBe("a@b.com");
		expect(hint?.hidden).toBe(true);

		fireEvent.change(screen.getByLabelText("Code"), {
			target: { value: "123456" },
		});
		fireEvent.change(screen.getByLabelText(/new password/i), {
			target: { value: "newpw123!" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Set password" }));
		await vi.waitFor(() => expect(signIn.finalize).toHaveBeenCalled());
		expect(signIn.resetPasswordEmailCode.verifyCode).toHaveBeenCalledWith({
			code: "123456",
		});
		expect(signIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({
			password: "newpw123!",
		});
		expect(onSuccess).toHaveBeenCalled();
	});

	it("shows catalog copy for an unknown email, in Dutch (APP-596)", async () => {
		signIn.create.mockResolvedValue({
			error: {
				errors: [{ code: "form_identifier_not_found", message: "No." }],
			},
		});
		renderForm(vi.fn(), "nl");
		fireEvent.change(screen.getByLabelText("E-mail"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Code versturen" }));
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Geen account gevonden met dat e-mailadres.",
		);
		expect(signIn.resetPasswordEmailCode.sendCode).not.toHaveBeenCalled();
	});

	it("says so when the reset needs a step it does not offer", async () => {
		signIn.create.mockResolvedValue(ok);
		signIn.resetPasswordEmailCode.sendCode.mockResolvedValue(ok);
		signIn.resetPasswordEmailCode.verifyCode.mockResolvedValue(ok);
		signIn.resetPasswordEmailCode.submitPassword.mockResolvedValue(ok);
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send code/i }));
		fireEvent.change(await screen.findByLabelText("Code"), {
			target: { value: "123456" },
		});
		fireEvent.change(screen.getByLabelText(/new password/i), {
			target: { value: "newpw123!" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Set password" }));
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Signing in to this account needs another step this page doesn't support yet.",
		);
		expect(signIn.finalize).not.toHaveBeenCalled();
		expect(onSuccess).not.toHaveBeenCalled();
	});

	it("asks for the second step after the new password", async () => {
		signIn.create.mockResolvedValue(ok);
		signIn.resetPasswordEmailCode.sendCode.mockResolvedValue(ok);
		signIn.resetPasswordEmailCode.verifyCode.mockResolvedValue(ok);
		signIn.resetPasswordEmailCode.submitPassword.mockImplementation(
			async () => {
				signIn.status = "needs_second_factor";
				return ok;
			},
		);
		signIn.mfa.verifyTOTP.mockImplementation(async () => {
			signIn.status = "complete";
			return ok;
		});
		signIn.finalize.mockResolvedValue(ok);
		const onSuccess = vi.fn();
		const onBackToSignIn = vi.fn();
		renderForm(onSuccess, "en", onBackToSignIn);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send code/i }));
		fireEvent.change(await screen.findByLabelText("Code"), {
			target: { value: "123456" },
		});
		fireEvent.change(screen.getByLabelText(/new password/i), {
			target: { value: "newpw123!" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Set password" }));
		expect(
			await screen.findByText(
				"Your password is changed. One more step to sign in.",
			),
		).toBeDefined();
		fireEvent.change(screen.getByLabelText("Code"), {
			target: { value: "654321" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Verify" }));
		await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
		expect(signIn.mfa.verifyTOTP).toHaveBeenCalledWith({ code: "654321" });
		expect(onBackToSignIn).not.toHaveBeenCalled();
	});

	it("reopens the second step after a reload (APP-833)", async () => {
		window.history.replaceState(null, "", "/forgot-password");
		sessionStorage.setItem("arcade-second-factor", "/forgot-password sia_1");
		signIn.id = "sia_1";
		signIn.status = "needs_second_factor";
		renderForm();
		expect(
			await screen.findByText(
				"Your password is changed. One more step to sign in.",
			),
		).toBeDefined();
	});

	it("drops a reset answered after a newer form opened (APP-833)", async () => {
		let answer: (value: typeof ok) => void = () => {};
		signIn.create.mockImplementation(
			() =>
				new Promise((resolve) => {
					answer = resolve;
				}),
		);
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /send code/i }));
		cleanup();
		renderForm();
		answer(ok);
		await new Promise((resolve) => setTimeout(resolve));
		expect(signIn.resetPasswordEmailCode.sendCode).not.toHaveBeenCalled();
		expect(screen.getByLabelText("Email")).toBeDefined();
	});
});
