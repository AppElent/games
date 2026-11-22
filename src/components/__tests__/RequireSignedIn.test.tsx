// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const router = {
	state: { location: { pathname: "/account", href: "/account" } },
};
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigate,
	useRouter: () => router,
}));
vi.mock("@clerk/react", () => ({
	Show: ({ when, children }: { when: string; children: React.ReactNode }) =>
		when === "signed-out" ? children : null,
}));

import { RequireSignedIn } from "../RequireSignedIn";

describe("RequireSignedIn", () => {
	afterEach(() => {
		cleanup();
		navigate.mockReset();
	});

	it("sends a signed-out visitor to sign-in once, with the page to return to", () => {
		const view = render(<RequireSignedIn>secret</RequireSignedIn>);
		// The location moves as the navigation starts; that must not send again.
		router.state.location = {
			pathname: "/sign-in",
			href: "/sign-in?redirect=%2Faccount",
		};
		view.rerender(<RequireSignedIn>secret</RequireSignedIn>);
		expect(navigate).toHaveBeenCalledTimes(1);
		expect(navigate).toHaveBeenCalledWith({
			to: "/sign-in",
			search: { redirect: "/account" },
		});
		expect(view.queryByText("secret")).toBeNull();
	});
});
