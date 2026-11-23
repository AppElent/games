// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const location = { href: "/cards/toepen?mode=online" };
vi.mock("@tanstack/react-router", () => ({
	useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
		select({ location }),
}));
vi.mock("@clerk/react", () => ({
	Show: ({ when, children }: { when: string; children: React.ReactNode }) =>
		when === "signed-out" ? children : null,
}));

import { LocaleProvider } from "#/lib/i18n";
import { HostGate } from "../HostGate";

function renderGate() {
	return render(
		<LocaleProvider initialLocale="en">
			<HostGate>host controls</HostGate>
		</LocaleProvider>,
	);
}

describe("HostGate", () => {
	afterEach(cleanup);

	it("sends a guest to sign-in with this page to return to (APP-596)", () => {
		renderGate();
		expect(screen.queryByText("host controls")).toBeNull();
		expect(
			screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
		).toBe("/sign-in?redirect=%2Fcards%2Ftoepen%3Fmode%3Donline");
	});
});
