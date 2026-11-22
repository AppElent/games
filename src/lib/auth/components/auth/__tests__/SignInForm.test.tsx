// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Clerk Core 3: methods resolve to `{ error }` and update the resource in place.
const signIn = {
	status: null as string | null,
	password: vi.fn(),
	finalize: vi.fn(),
	reset: vi.fn(),
	emailCode: { sendCode: vi.fn(), verifyCode: vi.fn() },
};
const errors = { fields: {}, global: null, raw: null };
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn, errors }) }));

import { type Locale, LocaleProvider } from "#/lib/i18n";
import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignInForm } from "../SignInForm";

const ok = { error: null };
const clerkError = (code: string) => ({ error: { errors: [{ code }] } });

function renderForm(onSuccess = vi.fn(), locale: Locale = "en") {
	return render(
		<LocaleProvider initialLocale={locale}>
			<AuthConfigProvider>
				<SignInForm onSuccess={onSuccess} />
			</AuthConfigProvider>
		</LocaleProvider>,
	);
}

function typeEmail(value = "a@b.com") {
	fireEvent.change(screen.getByLabelText("Email"), { target: { value } });
}

async function openCodeStep() {
	signIn.emailCode.sendCode.mockResolvedValue(ok);
	typeEmail();
	fireEvent.click(
		screen.getByRole("button", { name: "Email me a sign-in code" }),
	);
	return screen.findByLabelText("Code");
}

describe("SignInForm", () => {
	afterEach(() => {
		cleanup();
		signIn.status = null;
		for (const fn of [
			signIn.password,
			signIn.finalize,
			signIn.reset,
			signIn.emailCode.sendCode,
			signIn.emailCode.verifyCode,
		]) {
			fn.mockReset();
		}
	});

	it("submits credentials and activates the session", async () => {
		signIn.password.mockImplementation(async () => {
			signIn.status = "complete";
			return ok;
		});
		signIn.finalize.mockResolvedValue(ok);
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		typeEmail();
		fireEvent.change(screen.getByLabelText("Password"), {
			target: { value: "pw" },
		});
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		await vi.waitFor(() => expect(signIn.finalize).toHaveBeenCalled());
		expect(signIn.password).toHaveBeenCalledWith({
			identifier: "a@b.com",
			password: "pw",
		});
		expect(onSuccess).toHaveBeenCalled();
		expect(signIn.emailCode.sendCode).not.toHaveBeenCalled();
	});

	it("marks the credential fields for password managers", () => {
		renderForm();
		expect(screen.getByLabelText("Email").getAttribute("autocomplete")).toBe(
			"username",
		);
		expect(screen.getByLabelText("Password").getAttribute("autocomplete")).toBe(
			"current-password",
		);
	});

	it("shows a readable error on failure", async () => {
		signIn.password.mockResolvedValue({
			error: { errors: [{ message: "Invalid." }] },
		});
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect(await screen.findByText("Invalid.")).toBeDefined();
		expect(signIn.finalize).not.toHaveBeenCalled();
	});

	describe("email code", () => {
		it("asks for the email before sending a code", async () => {
			renderForm();
			fireEvent.click(
				screen.getByRole("button", { name: "Email me a sign-in code" }),
			);
			expect((await screen.findByRole("alert")).textContent).toBe(
				"Enter your email first.",
			);
			expect(signIn.emailCode.sendCode).not.toHaveBeenCalled();
		});

		it("sends a code, focuses the code field and signs in with it", async () => {
			signIn.emailCode.verifyCode.mockResolvedValue(ok);
			signIn.finalize.mockResolvedValue(ok);
			const onSuccess = vi.fn();
			renderForm(onSuccess);
			const field = await openCodeStep();
			expect(signIn.emailCode.sendCode).toHaveBeenCalledWith({
				emailAddress: "a@b.com",
			});
			expect(
				screen.getByText("We sent a 6-digit code to a@b.com."),
			).toBeDefined();
			expect(document.activeElement).toBe(field);
			expect(field.getAttribute("autocomplete")).toBe("one-time-code");
			expect(field.getAttribute("inputmode")).toBe("numeric");

			const submit = screen.getByRole("button", { name: "Sign in" });
			expect(submit.hasAttribute("disabled")).toBe(true);
			fireEvent.change(field, { target: { value: "12 34-56" } });
			expect((field as HTMLInputElement).value).toBe("123456");
			fireEvent.click(submit);
			await vi.waitFor(() => expect(onSuccess).toHaveBeenCalled());
			expect(signIn.emailCode.verifyCode).toHaveBeenCalledWith({
				code: "123456",
			});
			expect(signIn.finalize).toHaveBeenCalled();
		});

		it("shows catalog copy for an unknown email, not Clerk's text", async () => {
			signIn.emailCode.sendCode.mockResolvedValue(
				clerkError("form_identifier_not_found"),
			);
			renderForm();
			typeEmail("nobody@b.com");
			fireEvent.click(
				screen.getByRole("button", { name: "Email me a sign-in code" }),
			);
			expect((await screen.findByRole("alert")).textContent).toBe(
				"No account found with that email.",
			);
			expect(screen.queryByLabelText("Code")).toBeNull();
		});

		it.each([
			["form_code_incorrect", "That code is not right."],
			["verification_expired", "That code has expired. Send a new one."],
			["too_many_requests", "Too many attempts. Try again in a moment."],
		])("maps %s on verify", async (code, copy) => {
			signIn.emailCode.verifyCode.mockResolvedValue(clerkError(code));
			const onSuccess = vi.fn();
			renderForm(onSuccess);
			const field = await openCodeStep();
			fireEvent.change(field, { target: { value: "000000" } });
			fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
			expect((await screen.findByRole("alert")).textContent).toBe(copy);
			expect(signIn.finalize).not.toHaveBeenCalled();
			expect(onSuccess).not.toHaveBeenCalled();
		});

		it("resends a code and says so", async () => {
			renderForm();
			await openCodeStep();
			fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
			expect((await screen.findByRole("status")).textContent).toBe(
				"A new code is on its way.",
			);
			expect(signIn.emailCode.sendCode).toHaveBeenLastCalledWith();
		});

		it("returns to the email step and drops the attempt", async () => {
			signIn.reset.mockResolvedValue(ok);
			renderForm();
			await openCodeStep();
			fireEvent.click(
				screen.getByRole("button", { name: "Use a different email" }),
			);
			const email = await screen.findByLabelText("Email");
			expect(signIn.reset).toHaveBeenCalled();
			expect((email as HTMLInputElement).value).toBe("a@b.com");
			expect(document.activeElement).toBe(email);
		});

		it("speaks Dutch", async () => {
			signIn.emailCode.verifyCode.mockResolvedValue(
				clerkError("form_code_incorrect"),
			);
			renderForm(vi.fn(), "nl");
			signIn.emailCode.sendCode.mockResolvedValue(ok);
			fireEvent.change(screen.getByLabelText("E-mail"), {
				target: { value: "a@b.com" },
			});
			fireEvent.click(
				screen.getByRole("button", { name: "Mail me een inlogcode" }),
			);
			const field = await screen.findByLabelText("Code");
			fireEvent.change(field, { target: { value: "000000" } });
			fireEvent.click(screen.getByRole("button", { name: "Inloggen" }));
			expect((await screen.findByRole("alert")).textContent).toBe(
				"Die code klopt niet.",
			);
		});
	});
});
