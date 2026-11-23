// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ok = { error: null };
const signUp = {
	status: null as string | null,
	password: vi.fn(),
	finalize: vi.fn(),
	verifications: { sendEmailCode: vi.fn(), verifyEmailCode: vi.fn() },
};
vi.mock("@clerk/react", () => ({ useSignUp: () => ({ signUp }) }));

import { type Locale, LocaleProvider } from "#/lib/i18n";
import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignUpForm } from "../SignUpForm";

function renderForm(
	onSuccess = vi.fn(),
	{ locale = "en", redirect }: { locale?: Locale; redirect?: string } = {},
) {
	return render(
		<LocaleProvider initialLocale={locale}>
			<AuthConfigProvider>
				<SignUpForm onSuccess={onSuccess} redirect={redirect} />
			</AuthConfigProvider>
		</LocaleProvider>,
	);
}

function submitDetails() {
	fireEvent.change(screen.getByLabelText("Email"), {
		target: { value: "a@b.com" },
	});
	fireEvent.change(screen.getByLabelText("Password"), {
		target: { value: "pw12345!" },
	});
	fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("SignUpForm", () => {
	afterEach(() => {
		cleanup();
		signUp.status = null;
		for (const m of [
			signUp.password,
			signUp.finalize,
			...Object.values(signUp.verifications),
		])
			m.mockReset();
	});

	it("marks the credential fields for password managers", () => {
		renderForm();
		expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe(
			"username",
		);
		expect(screen.getByLabelText("Password").getAttribute("autocomplete")).toBe(
			"new-password",
		);
	});

	it("moves to the verification step after creating the account", async () => {
		signUp.password.mockResolvedValue(ok);
		signUp.verifications.sendEmailCode.mockResolvedValue(ok);
		renderForm();
		submitDetails();
		expect(await screen.findByLabelText("Code")).toBeDefined();
		expect(signUp.password).toHaveBeenCalledWith({
			emailAddress: "a@b.com",
			password: "pw12345!",
		});
		expect(signUp.verifications.sendEmailCode).toHaveBeenCalled();
	});

	it("verifies the code and completes sign-up", async () => {
		signUp.password.mockResolvedValue(ok);
		signUp.verifications.sendEmailCode.mockResolvedValue(ok);
		signUp.verifications.verifyEmailCode.mockImplementation(async () => {
			signUp.status = "complete";
			return ok;
		});
		signUp.finalize.mockResolvedValue(ok);
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		submitDetails();
		const code = await screen.findByLabelText("Code");
		fireEvent.change(code, { target: { value: "123456" } });
		fireEvent.click(screen.getByRole("button", { name: /verify/i }));
		await vi.waitFor(() => expect(signUp.finalize).toHaveBeenCalled());
		expect(signUp.verifications.verifyEmailCode).toHaveBeenCalledWith({
			code: "123456",
		});
		expect(onSuccess).toHaveBeenCalled();
	});

	it("shows catalog copy for a Clerk failure, not Clerk's text (APP-596)", async () => {
		signUp.password.mockResolvedValue({
			error: {
				code: "api_response_error",
				errors: [{ code: "form_identifier_exists", message: "Taken." }],
			},
		});
		renderForm();
		submitDetails();
		expect((await screen.findByRole("alert")).textContent).toBe(
			"An account with that email already exists.",
		);
	});

	it("speaks Dutch", () => {
		renderForm(vi.fn(), { locale: "nl" });
		expect(screen.getByLabelText("Wachtwoord")).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Account aanmaken" }),
		).toBeDefined();
	});

	it("keeps the return page on the link back to sign-in (APP-596)", () => {
		renderForm(vi.fn(), { redirect: "/sudoku?id=1" });
		expect(
			screen.getByRole("link", { name: /sign in/i }).getAttribute("href"),
		).toBe("/sign-in?redirect=%2Fsudoku%3Fid%3D1");
	});
});
