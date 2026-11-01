// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ok = { error: null };
const signIn = {
	status: null as string | null,
	create: vi.fn(),
	finalize: vi.fn(),
	resetPasswordEmailCode: {
		sendCode: vi.fn(),
		verifyCode: vi.fn(),
		submitPassword: vi.fn(),
	},
};
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn }) }));

import { AuthConfigProvider } from "../AuthConfigProvider";
import { ForgotPasswordForm } from "../ForgotPasswordForm";

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<ForgotPasswordForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("ForgotPasswordForm", () => {
	afterEach(() => {
		cleanup();
		signIn.status = null;
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

		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
		fireEvent.click(screen.getByRole("button", { name: /send code/i }));
		await vi.waitFor(() =>
			expect(signIn.resetPasswordEmailCode.sendCode).toHaveBeenCalled(),
		);
		expect(signIn.create).toHaveBeenCalledWith({ identifier: "a@b.com" });

		fireEvent.change(await screen.findByLabelText(/code/i), {
			target: { value: "123456" },
		});
		fireEvent.change(screen.getByLabelText(/new password/i), {
			target: { value: "newpw123!" },
		});
		fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
		await vi.waitFor(() => expect(signIn.finalize).toHaveBeenCalled());
		expect(signIn.resetPasswordEmailCode.verifyCode).toHaveBeenCalledWith({
			code: "123456",
		});
		expect(signIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({
			password: "newpw123!",
		});
		expect(onSuccess).toHaveBeenCalled();
	});
});
