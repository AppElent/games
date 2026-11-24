// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// jsdom here ships without localStorage (opaque origin) or matchMedia; the
// embedded AppearanceSettings touches both on mount, so provide minimal stubs.
beforeAll(() => {
	const store = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => store.set(k, v),
		removeItem: (k: string) => store.delete(k),
		clear: () => store.clear(),
	});
	vi.stubGlobal("matchMedia", (query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		onchange: null,
		dispatchEvent: () => false,
	}));
});

const update = vi.fn();
const updatePassword = vi.fn();
const signOut = vi.fn();
// Stable user reference so ProfilePanel's seeding effect (deps: [user]) doesn't
// re-run on every render and clobber typed input.
const user = {
	passwordEnabled: true,
	firstName: "Eric",
	lastName: "Jansen",
	primaryEmailAddress: { emailAddress: "e@x.com" },
	update,
	updatePassword,
};
vi.mock("@clerk/react", () => ({
	useUser: () => ({ isLoaded: true, isSignedIn: true, user }),
	useClerk: () => ({ signOut }),
}));

import { LocaleProvider } from "#/lib/i18n";
import { ProfilePanel } from "../ProfilePanel";

function renderPanel(locale: "en" | "nl" = "en") {
	return render(<ProfilePanel />, {
		wrapper: ({ children }: { children: ReactNode }) => (
			<LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
		),
	});
}

function clerkError(code: string, paramName: string) {
	return { errors: [{ code, message: "Clerk says no", meta: { paramName } }] };
}

const PASSWORD_LABELS = {
	en: {
		current: "Current password",
		new: "New password",
		submit: /^change password$/i,
	},
	nl: {
		current: "Huidig wachtwoord",
		new: "Nieuw wachtwoord",
		submit: /^wachtwoord wijzigen$/i,
	},
};

async function submitPassword(
	current: string,
	next: string,
	locale: "en" | "nl" = "en",
) {
	const labels = PASSWORD_LABELS[locale];
	fireEvent.change(screen.getByLabelText(labels.current), {
		target: { value: current },
	});
	fireEvent.change(screen.getByLabelText(labels.new), {
		target: { value: next },
	});
	fireEvent.click(screen.getByRole("button", { name: labels.submit }));
	await vi.waitFor(() => expect(updatePassword).toHaveBeenCalled());
}

describe("ProfilePanel", () => {
	afterEach(() => {
		cleanup();
		user.passwordEnabled = true;
		for (const m of [update, updatePassword, signOut]) m.mockReset();
	});

	it("saves name changes", async () => {
		update.mockResolvedValue({});
		renderPanel();
		fireEvent.change(screen.getByLabelText("First name"), {
			target: { value: "Erik" },
		});
		fireEvent.click(screen.getByRole("button", { name: /save profile/i }));
		await vi.waitFor(() =>
			expect(update).toHaveBeenCalledWith({
				firstName: "Erik",
				lastName: "Jansen",
			}),
		);
	});

	it("names the account in the change-password form", () => {
		renderPanel();
		const form = screen.getByLabelText("New password").closest("form");
		const hint = form?.querySelector<HTMLInputElement>(
			'input[autocomplete="username"]',
		);
		expect(hint?.value).toBe("e@x.com");
		expect(hint?.hidden).toBe(true);
	});

	it("signs the other sessions out when the password changes", async () => {
		updatePassword.mockResolvedValue({});
		renderPanel();
		await submitPassword("old-pass-123", "new-pass-456");
		expect(updatePassword).toHaveBeenCalledWith({
			currentPassword: "old-pass-123",
			newPassword: "new-pass-456",
			signOutOfOtherSessions: true,
		});
		expect(
			await screen.findByText(/your other devices are signed out/i),
		).toBeTruthy();
		expect(
			(screen.getByLabelText("Current password") as HTMLInputElement).value,
		).toBe("");
	});

	it("puts a wrong current password on the current field", async () => {
		updatePassword.mockRejectedValue(
			clerkError("form_password_validation_failed", "current_password"),
		);
		renderPanel();
		await submitPassword("wrong", "new-pass-456");
		const current = screen.getByLabelText("Current password");
		const message = await screen.findByText("That password is not right.");
		expect(current.getAttribute("aria-describedby")).toBe(message.id);
		expect(
			screen.getByLabelText("New password").getAttribute("aria-describedby"),
		).toBeNull();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("clears a field's error once that field is edited", async () => {
		updatePassword.mockRejectedValue(
			clerkError("form_password_validation_failed", "current_password"),
		);
		renderPanel();
		await submitPassword("wrong", "new-pass-456");
		const current = screen.getByLabelText("Current password");
		await screen.findByText("That password is not right.");
		expect(current.getAttribute("aria-invalid")).toBe("true");
		fireEvent.change(current, { target: { value: "wrong-again" } });
		expect(screen.queryByText("That password is not right.")).toBeNull();
		expect(current.getAttribute("aria-invalid")).toBeNull();
	});

	it("puts a weak new password on the new field", async () => {
		updatePassword.mockRejectedValue(
			clerkError("form_password_validation_failed", "new_password"),
		);
		renderPanel();
		await submitPassword("old-pass-123", "weak");
		const message = await screen.findByText(
			"That password is not strong enough.",
		);
		expect(
			screen.getByLabelText("New password").getAttribute("aria-describedby"),
		).toBe(message.id);
		expect(
			screen
				.getByLabelText("Current password")
				.getAttribute("aria-describedby"),
		).toBeNull();
	});

	it("shows other failures above the panel as catalog copy", async () => {
		updatePassword.mockRejectedValue({
			errors: [{ code: "too_many_requests", message: "Slow down." }],
		});
		renderPanel();
		await submitPassword("old-pass-123", "new-pass-456");
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Too many attempts. Try again in a moment.",
		);
	});

	it("shows an unknown Clerk failure in Dutch, not Clerk's English (APP-596)", async () => {
		updatePassword.mockRejectedValue({
			errors: [{ code: "something_new", message: "Clerk says no." }],
		});
		renderPanel("nl");
		await submitPassword("old-pass-123", "new-pass-456", "nl");
		expect((await screen.findByRole("alert")).textContent).toBe(
			"Er ging iets mis. Probeer het opnieuw.",
		);
	});

	it("explains instead of asking for a password the account does not have", () => {
		user.passwordEnabled = false;
		renderPanel();
		expect(screen.queryByLabelText("Current password")).toBeNull();
		expect(screen.queryByLabelText("New password")).toBeNull();
		expect(screen.getByText(/signs in without a password/i)).toBeTruthy();
	});

	it("explains it in Dutch too", () => {
		user.passwordEnabled = false;
		renderPanel("nl");
		expect(screen.getByText(/logt in zonder wachtwoord/i)).toBeTruthy();
	});

	it("shows the whole panel in Dutch", () => {
		renderPanel("nl");
		for (const text of [
			"Profiel",
			"E-mail: e@x.com",
			"Weergave",
			"Kies hoe Arcade Club eruitziet. Systeem volgt je apparaat.",
			"Sessie",
		]) {
			expect(screen.getByText(text)).toBeTruthy();
		}
		expect(screen.getByLabelText("Voornaam")).toBeTruthy();
		expect(screen.getByLabelText("Achternaam")).toBeTruthy();
		for (const name of [
			"Profiel opslaan",
			"Licht",
			"Systeem",
			"Donker",
			"Uitloggen",
		]) {
			expect(screen.getByRole("button", { name })).toBeTruthy();
		}
		expect(screen.queryByText(/^(Profile|Session|Appearance)$/)).toBeNull();
	});

	it("signs out", () => {
		renderPanel();
		fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
		expect(signOut).toHaveBeenCalled();
	});
});
