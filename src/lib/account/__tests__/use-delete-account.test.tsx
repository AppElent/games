// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteAccount } from "#/lib/account/use-delete-account";
import { LocaleProvider } from "#/lib/i18n";

const deleteMyData = vi.fn();
const deleteUser = vi.fn();
const signOut = vi.fn();
let deleteSelfEnabled = true;

vi.mock("@clerk/react", () => ({
	useUser: () => ({
		user: { id: "user_1", deleteSelfEnabled, delete: deleteUser },
	}),
	useClerk: () => ({ signOut }),
}));
vi.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useMutation: () => deleteMyData,
}));

function wrapper({ children }: { children: ReactNode }) {
	return <LocaleProvider initialLocale="en">{children}</LocaleProvider>;
}

async function runDeletion() {
	const hook = renderHook(() => useDeleteAccount(), { wrapper });
	let ok: boolean | undefined;
	await act(async () => {
		ok = await hook.result.current.deleteAccount();
	});
	return { ok, result: hook.result };
}

/** The `ConvexError` shape the backend throws for a keyed refusal. */
function refusal(code: string, params?: Record<string, number>) {
	return Object.assign(new Error(code), { data: { code, params } });
}

describe("useDeleteAccount", () => {
	beforeEach(() => {
		deleteSelfEnabled = true;
		deleteUser.mockResolvedValue(undefined);
		signOut.mockResolvedValue(undefined);
	});
	afterEach(() => {
		cleanup();
		vi.resetAllMocks();
	});

	it("deletes data batch by batch as this account, then the user, then signs out", async () => {
		deleteMyData
			.mockResolvedValueOnce({ done: false })
			.mockResolvedValueOnce({ done: false })
			.mockResolvedValueOnce({ done: true });
		const { ok, result } = await runDeletion();
		expect(ok).toBe(true);
		expect(deleteMyData).toHaveBeenCalledTimes(3);
		for (const call of deleteMyData.mock.calls) {
			expect(call[0]).toEqual({ expectedSubject: "user_1" });
		}
		expect(deleteUser).toHaveBeenCalledOnce();
		expect(signOut).toHaveBeenCalledWith({ redirectUrl: "/" });
		expect(deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(
			deleteMyData.mock.invocationCallOrder[2],
		);
		expect(result.current.error).toBe("");
		expect(result.current.busy).toBe(false);
	});

	it("shows the active-game refusal, keeps the account, and resumes on a rerun", async () => {
		deleteMyData
			.mockResolvedValueOnce({ done: false })
			.mockRejectedValueOnce(refusal("accountInActiveGame", { minutes: 30 }));
		const first = await runDeletion();
		expect(first.ok).toBe(false);
		expect(first.result.current.error).toContain("30");
		expect(first.result.current.error).not.toBe(
			"Your account could not be deleted. Try again.",
		);
		expect(deleteUser).not.toHaveBeenCalled();
		expect(signOut).not.toHaveBeenCalled();

		deleteMyData.mockResolvedValueOnce({ done: true });
		await act(async () => {
			await first.result.current.deleteAccount();
		});
		expect(deleteUser).toHaveBeenCalledOnce();
		expect(signOut).toHaveBeenCalledOnce();
		expect(first.result.current.error).toBe("");
	});

	it("shows the generic message when a batch is interrupted", async () => {
		deleteMyData.mockRejectedValueOnce(new Error("[CONVEX M] network"));
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(result.current.error).toBe(
			"Your account could not be deleted. Try again.",
		);
		expect(deleteUser).not.toHaveBeenCalled();
	});

	it("deletes nothing when the Clerk instance does not allow self-deletion", async () => {
		deleteSelfEnabled = false;
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(result.current.error).toBe(
			"Deleting your account isn't available right now.",
		);
		expect(deleteMyData).not.toHaveBeenCalled();
	});
});
