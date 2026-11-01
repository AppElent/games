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

import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignUpForm } from "../SignUpForm";

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<SignUpForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
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

	it("moves to the verification step after creating the account", async () => {
		signUp.password.mockResolvedValue(ok);
		signUp.verifications.sendEmailCode.mockResolvedValue(ok);
		renderForm();
		submitDetails();
		expect(await screen.findByLabelText(/verification code/i)).toBeDefined();
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
		const code = await screen.findByLabelText(/verification code/i);
		fireEvent.change(code, { target: { value: "123456" } });
		fireEvent.click(screen.getByRole("button", { name: /verify/i }));
		await vi.waitFor(() => expect(signUp.finalize).toHaveBeenCalled());
		expect(signUp.verifications.verifyEmailCode).toHaveBeenCalledWith({
			code: "123456",
		});
		expect(onSuccess).toHaveBeenCalled();
	});
});
