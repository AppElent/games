// @vitest-environment jsdom
import { ACCOUNT_PORTAL_URL } from "@arcadeclub/core/account-portal";
import { messages } from "@arcadeclub/core/messages";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { ManageAccount } from "../ManageAccount";

afterEach(cleanup);

describe("ManageAccount", () => {
	it.each(["en", "nl"] as const)(
		"links to the AppElent account portal in a new tab (%s)",
		(locale) => {
			const copy = messages[locale].profile.accountPortal;
			render(
				<LocaleProvider initialLocale={locale}>
					<ManageAccount />
				</LocaleProvider>,
			);

			expect(screen.getByRole("heading", { name: copy.title })).toBeTruthy();
			const link = screen.getByRole("link", {
				name: `${copy.action} ${copy.newTab}`,
			});
			expect(link.getAttribute("href")).toBe(ACCOUNT_PORTAL_URL);
			expect(ACCOUNT_PORTAL_URL).toBe("https://account.appelent.nl");
			expect(link.getAttribute("target")).toBe("_blank");
			expect(link.getAttribute("rel")).toBe("noopener noreferrer");
		},
	);
});
