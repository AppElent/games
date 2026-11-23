// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { type Locale, LocaleProvider } from "#/lib/i18n";
import { AuthButton } from "../AuthButton";
import { AuthError } from "../AuthError";
import { AuthField } from "../AuthField";

function inLocale(locale: Locale) {
	return ({ children }: { children: ReactNode }) => (
		<LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
	);
}

describe("auth primitives", () => {
	afterEach(cleanup);

	it("AuthField renders label and shows error text", () => {
		render(
			<AuthField
				label="Email"
				type="email"
				value=""
				onChange={() => {}}
				error="Required"
			/>,
		);
		expect(screen.getByLabelText("Email")).toBeDefined();
		expect(screen.getByText("Required")).toBeDefined();
	});

	it("AuthField links the input to its error via aria-describedby", () => {
		render(
			<AuthField
				label="Email"
				type="email"
				value=""
				onChange={() => {}}
				error="Required"
			/>,
		);
		const describedBy = screen
			.getByLabelText("Email")
			.getAttribute("aria-describedby");
		expect(describedBy).toBeTruthy();
		expect(document.getElementById(describedBy as string)?.textContent).toBe(
			"Required",
		);
	});

	it("AuthField has no aria-describedby without an error", () => {
		render(
			<AuthField label="Email" type="email" value="" onChange={() => {}} />,
		);
		expect(
			screen.getByLabelText("Email").getAttribute("aria-describedby"),
		).toBeNull();
	});

	it("AuthButton shows loading and disables", () => {
		render(<AuthButton loading>Sign in</AuthButton>, {
			wrapper: inLocale("en"),
		});
		const btn = screen.getByRole("button");
		expect(btn.hasAttribute("disabled")).toBe(true);
		expect(btn.textContent).toBe("Please wait…");
	});

	it("AuthButton says to wait in the page's language (APP-596)", () => {
		render(<AuthButton loading>Inloggen</AuthButton>, {
			wrapper: inLocale("nl"),
		});
		expect(screen.getByRole("button").textContent).toBe("Even geduld…");
	});

	it("AuthButton sets aria-busy while loading and clears it when idle", () => {
		const { rerender } = render(<AuthButton loading>Sign in</AuthButton>, {
			wrapper: inLocale("en"),
		});
		expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("true");
		rerender(<AuthButton>Sign in</AuthButton>);
		expect(screen.getByRole("button").getAttribute("aria-busy")).toBe("false");
	});

	it("AuthError renders nothing when message is empty", () => {
		const { container } = render(<AuthError message={null} />);
		expect(container.firstChild).toBeNull();
	});
});
