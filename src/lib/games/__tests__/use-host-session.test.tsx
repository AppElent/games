// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHostSession } from "#/lib/games/use-host-session";
import { LocaleProvider } from "#/lib/i18n";
import type { Id } from "../../../../convex/_generated/dataModel";

let user: { firstName: string | null; username: string | null } | null = null;
vi.mock("@clerk/react", () => ({ useUser: () => ({ user }) }));

function wrapper({ children }: { children: ReactNode }) {
	return <LocaleProvider initialLocale="en">{children}</LocaleProvider>;
}

const created = {
	sessionId: "s1" as Id<"gameSessions">,
	participantId: "p1" as Id<"sessionParticipants">,
};

async function hostName() {
	const open = vi.fn(async () => {});
	const { result } = renderHook(() => useHostSession("sudoku", { open }), {
		wrapper,
	});
	const create = vi.fn(async () => created);
	await act(async () => {
		await result.current.host(create, "Failed");
	});
	expect(open).toHaveBeenCalledWith(created);
	return (create.mock.calls[0] as unknown as [{ displayName: string }])[0]
		.displayName;
}

describe("useHostSession", () => {
	afterEach(() => {
		cleanup();
		user = null;
	});

	it("hosts under the account's first name when signed in", async () => {
		user = { firstName: "Ada", username: "ada99" };
		expect(await hostName()).toBe("Ada");
	});

	it("hosts under this device's guest name when signed out", async () => {
		const name = await hostName();
		expect(name).not.toBe("Ada");
		expect(name.length).toBeGreaterThan(0);
	});

	it("clears busy and shows the error when creating fails", async () => {
		const { result } = renderHook(() => useHostSession("sudoku"), { wrapper });
		await act(async () => {
			await result.current.host(async () => {
				throw new Error("down");
			}, "Could not host");
		});
		expect(result.current.busy).toBe(false);
		expect(result.current.error).toBe("Could not host");
	});
});
