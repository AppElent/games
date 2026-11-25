// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const signIn = {
	status: null as string | null,
	password: vi.fn(),
	finalize: vi.fn(),
};
vi.mock("@clerk/react", () => ({ useSignIn: () => ({ signIn }) }));

import type { ReactNode } from "react";
import { LocaleProvider } from "#/lib/i18n";
import { TestLoginButton } from "../TestLoginButton";

const wrapper = ({ children }: { children: ReactNode }) => (
	<LocaleProvider initialLocale="en">{children}</LocaleProvider>
);

function showButton() {
	vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_x");
	vi.stubEnv("VITE_TEST_USER_EMAIL", "test@test.com");
	vi.stubEnv("VITE_TEST_USER_PASSWORD", "appelent_test");
}

describe("TestLoginButton", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
		signIn.status = null;
		signIn.password.mockReset();
		signIn.finalize.mockReset();
	});

	it("renders nothing without a test instance + creds", () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_live_x");
		const { container } = render(
			<TestLoginButton onSuccess={() => {}} onSecondFactor={() => {}} />,
			{
				wrapper,
			},
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders nothing on a test instance when creds are absent", () => {
		vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "pk_test_x");
		vi.stubEnv("VITE_TEST_USER_EMAIL", "");
		vi.stubEnv("VITE_TEST_USER_PASSWORD", "");
		const { container } = render(
			<TestLoginButton onSuccess={() => {}} onSecondFactor={() => {}} />,
			{
				wrapper,
			},
		);
		expect(container.firstChild).toBeNull();
	});

	it("signs in with env creds when shown and clicked", async () => {
		showButton();
		signIn.password.mockImplementation(async () => {
			signIn.status = "complete";
			return { error: null };
		});
		signIn.finalize.mockResolvedValue({ error: null });
		const onSuccess = vi.fn();

		render(
			<TestLoginButton onSuccess={onSuccess} onSecondFactor={() => {}} />,
			{ wrapper },
		);
		screen.getByRole("button", { name: /test/i }).click();
		await vi.waitFor(() => expect(signIn.finalize).toHaveBeenCalled());
		expect(signIn.password).toHaveBeenCalledWith({
			identifier: "test@test.com",
			password: "appelent_test",
		});
		expect(onSuccess).toHaveBeenCalled();
	});

	it("stays disabled while the form runs another request (APP-596)", () => {
		showButton();
		render(
			<TestLoginButton
				onSuccess={() => {}}
				onSecondFactor={() => {}}
				disabled
			/>,
			{ wrapper },
		);
		expect(
			screen.getByRole("button", { name: /test/i }).hasAttribute("disabled"),
		).toBe(true);
	});

	it("shows catalog copy, not Clerk's text, when sign-in fails", async () => {
		showButton();
		signIn.password.mockResolvedValue({
			error: { errors: [{ code: "form_password_incorrect", message: "Nope" }] },
		});
		render(<TestLoginButton onSuccess={() => {}} onSecondFactor={() => {}} />, {
			wrapper,
		});
		screen.getByRole("button", { name: /test/i }).click();
		expect((await screen.findByRole("alert")).textContent).toBe(
			"That password is not right.",
		);
	});
});
