// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Clerk Core 3: methods resolve to `{ error }` and update the resource in place.
const signIn = {
	status: null as string | null,
	password: vi.fn(),
	finalize: vi.fn(),
};
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn }) }));

import { AuthConfigProvider } from "../AuthConfigProvider";
import { SignInForm } from "../SignInForm";

function renderForm(onSuccess = vi.fn()) {
	return render(
		<AuthConfigProvider>
			<SignInForm onSuccess={onSuccess} />
		</AuthConfigProvider>,
	);
}

describe("SignInForm", () => {
	afterEach(() => {
		cleanup();
		signIn.status = null;
		signIn.password.mockReset();
		signIn.finalize.mockReset();
	});

	it("submits credentials and activates the session", async () => {
		signIn.password.mockImplementation(async () => {
			signIn.status = "complete";
			return { error: null };
		});
		signIn.finalize.mockResolvedValue({ error: null });
		const onSuccess = vi.fn();
		renderForm(onSuccess);
		fireEvent.change(screen.getByLabelText("Email"), {
			target: { value: "a@b.com" },
		});
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
});
