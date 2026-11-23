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
const errors: { fields: object; global: null; raw: null } = {
	fields: {},
	global: null,
	raw: null,
};
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn, errors }) }));

import { type Locale, LocaleProvider } from "#/lib/i18n";
import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignInForm } from "../SignInForm";

const ok = { error: null };
const clerkError = (code: string) => ({ error: { errors: [{ code }] } });

function renderForm(
	onSuccess = vi.fn(),
	locale: Locale = "en",
	redirect?: string,
) {
	return render(
		<LocaleProvider initialLocale={locale}>
			<AuthConfigProvider>
				<SignInForm onSuccess={onSuccess} redirect={redirect} />
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
		errors.fields = {};
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

	it("shows catalog copy for a password failure, not Clerk's text", async () => {
		signIn.password.mockResolvedValue({
			error: {
				errors: [
					{ code: "form_password_incorrect", longMessage: "Clerk says no." },
				],
			},
		});
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect((await screen.findByRole("alert")).textContent).toBe(
			"That password is not right.",
		);
		expect(screen.queryByText("Clerk says no.")).toBeNull();
		expect(signIn.finalize).not.toHaveBeenCalled();
	});

	it("points a code-only account to the emailed code", async () => {
		// The real shape: Clerk's wrapper code on top, the API code inside.
		signIn.password.mockResolvedValue({
			error: {
				code: "api_response_error",
				errors: [{ code: "strategy_for_user_invalid" }],
			},
		});
		renderForm();
		fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
		expect((await screen.findByRole("alert")).textContent).toBe(
			'This account has no password. Use "Email me a sign-in code" instead.',
		);
	});

	it("says so when the password sign-in needs a step it does not offer", async () => {
		signIn.password.mockImplementation(async () => {
			signIn.status = "needs_second_factor";
			return ok;
		});
		renderForm(vi.fn(), "nl");
		fireEvent.click(screen.getByRole("button", { name: "Inloggen" }));
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Inloggen op dit account vraagt een extra stap die deze pagina nog niet ondersteunt.",
		);
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
			signIn.emailCode.verifyCode.mockImplementation(async () => {
				signIn.status = "complete";
				return ok;
			});
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
			// The step's focus effect is passive: it can run after the field is found.
			await vi.waitFor(() => expect(document.activeElement).toBe(field));
			expect(field.getAttribute("autocomplete")).toBe("one-time-code");
			expect(field.getAttribute("inputmode")).toBe("numeric");
			const describedBy = field.getAttribute("aria-describedby") ?? "";
			expect(document.getElementById(describedBy)?.textContent).toBe(
				"We sent a 6-digit code to a@b.com.",
			);

			const submit = screen.getByRole("button", { name: "Sign in" });
			expect(submit.hasAttribute("disabled")).toBe(true);
			// A pasted code with separators, longer than six characters.
			fireEvent.change(field, { target: { value: "123-456-7" } });
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
			const alert = await screen.findByRole("alert");
			expect(alert.textContent).toBe(copy);
			expect(field.getAttribute("aria-invalid")).toBe("true");
			expect(field.getAttribute("aria-describedby")).toContain(alert.id);
			expect(signIn.finalize).not.toHaveBeenCalled();
			expect(onSuccess).not.toHaveBeenCalled();
			await vi.waitFor(() => expect(document.activeElement).toBe(field));
		});

		it("stops on a step it does not offer instead of finalizing", async () => {
			signIn.emailCode.verifyCode.mockImplementation(async () => {
				signIn.status = "needs_second_factor";
				return ok;
			});
			const onSuccess = vi.fn();
			renderForm(onSuccess);
			const field = await openCodeStep();
			fireEvent.change(field, { target: { value: "424242" } });
			fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
			expect((await screen.findByRole("alert")).textContent).toBe(
				"Signing in to this account needs another step this page doesn't support yet.",
			);
			expect(signIn.finalize).not.toHaveBeenCalled();
			expect(onSuccess).not.toHaveBeenCalled();
		});

		it("returns focus to the email field when sending fails", async () => {
			signIn.emailCode.sendCode.mockResolvedValue(
				clerkError("too_many_requests"),
			);
			renderForm();
			typeEmail();
			fireEvent.click(
				screen.getByRole("button", { name: "Email me a sign-in code" }),
			);
			expect((await screen.findByRole("alert")).textContent).toBe(
				"Too many attempts. Try again in a moment.",
			);
			await vi.waitFor(() =>
				expect(document.activeElement).toBe(screen.getByLabelText("Email")),
			);
		});

		it("reads Clerk's field error before the returned wrapper", async () => {
			signIn.emailCode.verifyCode.mockImplementation(async () => {
				errors.fields = { code: { code: "verification_expired" } };
				return clerkError("something_new");
			});
			renderForm();
			const field = await openCodeStep();
			fireEvent.change(field, { target: { value: "000000" } });
			fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
			expect((await screen.findByRole("alert")).textContent).toBe(
				"That code has expired. Send a new one.",
			);
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
			// The step's focus effect is passive: it can run after the field is found.
			await vi.waitFor(() => expect(document.activeElement).toBe(email));
		});

		it("shows catalog copy when finalize throws after a good code", async () => {
			signIn.emailCode.verifyCode.mockImplementation(async () => {
				signIn.status = "complete";
				return ok;
			});
			signIn.finalize.mockRejectedValue(new Error("network down"));
			const onSuccess = vi.fn();
			renderForm(onSuccess);
			const field = await openCodeStep();
			fireEvent.change(field, { target: { value: "123456" } });
			fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
			expect((await screen.findByRole("alert")).textContent).toBe(
				"Something went wrong. Please try again.",
			);
			expect(onSuccess).not.toHaveBeenCalled();
			// Not stuck busy: the code can be sent again.
			expect(
				screen
					.getByRole("button", { name: "Send a new code" })
					.hasAttribute("disabled"),
			).toBe(false);
		});

		it("verifies once on a double click", async () => {
			let finish: (value: typeof ok) => void = () => {};
			signIn.emailCode.verifyCode.mockImplementation(
				() =>
					new Promise((resolve) => {
						finish = resolve;
					}),
			);
			renderForm();
			const field = await openCodeStep();
			fireEvent.change(field, { target: { value: "123456" } });
			const submit = screen.getByRole("button", { name: "Sign in" });
			fireEvent.click(submit);
			fireEvent.click(submit);
			fireEvent.submit(field.closest("form") as HTMLFormElement);
			expect(signIn.emailCode.verifyCode).toHaveBeenCalledTimes(1);
			signIn.status = "complete";
			signIn.finalize.mockResolvedValue(ok);
			finish(ok);
			await vi.waitFor(() => expect(signIn.finalize).toHaveBeenCalledTimes(1));
		});

		it("still returns to the email step when dropping the attempt fails", async () => {
			signIn.reset.mockRejectedValue(new Error("offline"));
			renderForm();
			await openCodeStep();
			fireEvent.click(
				screen.getByRole("button", { name: "Use a different email" }),
			);
			expect(await screen.findByLabelText("Email")).toBeDefined();
			expect(signIn.reset).toHaveBeenCalled();
			expect(screen.queryByRole("alert")).toBeNull();
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

	it("keeps the return page on the sign-up and reset links (APP-596)", () => {
		renderForm(vi.fn(), "en", "/cards/toepen");
		expect(
			screen
				.getByRole("link", { name: "Create an account" })
				.getAttribute("href"),
		).toBe("/sign-up?redirect=%2Fcards%2Ftoepen");
		expect(
			screen
				.getByRole("link", { name: "Forgot password?" })
				.getAttribute("href"),
		).toBe("/forgot-password?redirect=%2Fcards%2Ftoepen");
	});

	it("leaves an unsafe return page off the links", () => {
		renderForm(vi.fn(), "en", "//evil.example");
		expect(
			screen
				.getByRole("link", { name: "Create an account" })
				.getAttribute("href"),
		).toBe("/sign-up");
	});
});
