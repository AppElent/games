// @vitest-environment jsdom
import type { DeletionScope } from "@arcadeclub/core/account-deletion";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteAccount } from "#/lib/account/use-delete-account";
import { LocaleProvider } from "#/lib/i18n";

const deleteMyData = vi.fn();
const deleteUser = vi.fn();
const signOut = vi.fn();
let deleteSelfEnabled = true;
/** Whether the session's sign-in is recent enough for Clerk. */
let recentSignIn = true;
/** How the person answers Clerk's verify dialog. */
let verifies = true;
let verifyPrompts = 0;
/** The live Clerk user; another tab can switch it. */
let clerkUserId = "user_1";
const checkAuthorization = vi.fn();
const cancelled = { code: "reverification_cancelled" };

type Fetcher = (...args: unknown[]) => Promise<unknown>;
vi.mock("@clerk/react", () => ({
	useUser: () => ({
		user: { id: "user_1", deleteSelfEnabled },
	}),
	useClerk: () => ({
		signOut,
		get session() {
			return { id: "sess_1", checkAuthorization, reload: async () => {} };
		},
		get user() {
			return { id: clerkUserId, delete: deleteUser };
		},
	}),
	// Mirrors Clerk: a reverification hint, or the
	// session_reverification_required API error, opens the verify dialog, then
	// the call runs once more and that result is returned as is; closing the
	// dialog rejects.
	useReverification:
		(fetcher: Fetcher) =>
		async (...args: unknown[]) => {
			const attempt = () =>
				fetcher(...args).catch((error: { errors?: { code: string }[] }) => {
					if (error?.errors?.[0]?.code === "session_reverification_required")
						return { clerk_error: { reason: "reverification-error" } };
					throw error;
				});
			const result = (await attempt()) as { clerk_error?: unknown } | undefined;
			if (!result?.clerk_error) return result;
			verifyPrompts++;
			if (!verifies) throw cancelled;
			recentSignIn = true;
			return attempt();
		},
}));
vi.mock("@clerk/react/errors", () => ({
	isReverificationCancelledError: (error: unknown) => error === cancelled,
}));
const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("convex/react", () => ({
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
	useMutation: () => deleteMyData,
}));

function wrapper({ children }: { children: ReactNode }) {
	return <LocaleProvider initialLocale="en">{children}</LocaleProvider>;
}

async function runDeletion(scope: DeletionScope = "account") {
	const hook = renderHook(() => useDeleteAccount(), { wrapper });
	let ok: boolean | undefined;
	await act(async () => {
		ok = await hook.result.current.deleteAccount(scope);
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
		recentSignIn = true;
		verifies = true;
		verifyPrompts = 0;
		clerkUserId = "user_1";
		checkAuthorization.mockImplementation(() => recentSignIn);
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
		expect(navigate).toHaveBeenCalledWith({
			to: "/",
			search: {},
			replace: true,
		});
		expect(deleteUser.mock.invocationCallOrder[0]).toBeGreaterThan(
			deleteMyData.mock.invocationCallOrder[2],
		);
		expect(result.current.error).toBe("");
		expect(result.current.busy).toBe(false);
	});

	it("deletes only Arcade Club's data, keeps the Clerk user and signs out to the confirmation", async () => {
		deleteMyData
			.mockResolvedValueOnce({ done: false })
			.mockResolvedValueOnce({ done: true });
		const { ok, result } = await runDeletion("app");
		expect(ok).toBe(true);
		expect(checkAuthorization).toHaveBeenCalled();
		expect(deleteMyData).toHaveBeenCalledTimes(2);
		expect(deleteUser).not.toHaveBeenCalled();
		expect(signOut).toHaveBeenCalledWith({ redirectUrl: "/?deleted=app" });
		expect(navigate).toHaveBeenCalledWith({
			to: "/",
			search: { deleted: "app" },
			replace: true,
		});
		expect(result.current.error).toBe("");
	});

	it("deletes only the data even where the Clerk instance does not allow self-deletion", async () => {
		deleteSelfEnabled = false;
		deleteMyData.mockResolvedValueOnce({ done: true });
		const { ok } = await runDeletion("app");
		expect(ok).toBe(true);
		expect(deleteUser).not.toHaveBeenCalled();
	});

	it("asks for a recent sign-in before deleting only the data", async () => {
		recentSignIn = false;
		verifies = false;
		const { ok } = await runDeletion("app");
		expect(ok).toBe(false);
		expect(verifyPrompts).toBe(1);
		expect(deleteMyData).not.toHaveBeenCalled();
	});

	it("shows the active-game refusal, keeps the account, and resumes on a rerun", async () => {
		deleteMyData
			.mockResolvedValueOnce({ done: false })
			.mockRejectedValueOnce(refusal("accountInActiveGame", { minutes: 30 }));
		const first = await runDeletion();
		expect(first.ok).toBe(false);
		expect(first.result.current.error).toContain("30");
		expect(first.result.current.error).not.toBe(
			"Your data could not be deleted. Try again.",
		);
		expect(deleteUser).not.toHaveBeenCalled();
		expect(signOut).not.toHaveBeenCalled();

		deleteMyData.mockResolvedValueOnce({ done: true });
		await act(async () => {
			await first.result.current.deleteAccount("account");
		});
		expect(deleteUser).toHaveBeenCalledOnce();
		expect(signOut).toHaveBeenCalledOnce();
		expect(first.result.current.error).toBe("");
	});

	it("refuses after an account switch and keeps the signed-in user", async () => {
		deleteMyData.mockRejectedValueOnce(refusal("accountChanged"));
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(result.current.error).toBe(
			"You switched accounts. Sign in to the account you want to delete and try again.",
		);
		expect(deleteUser).not.toHaveBeenCalled();
		expect(signOut).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});

	it("shows the generic message when a batch is interrupted", async () => {
		deleteMyData.mockRejectedValueOnce(new Error("[CONVEX M] network"));
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(result.current.error).toBe(
			"Your data could not be deleted. Try again.",
		);
		expect(deleteUser).not.toHaveBeenCalled();
	});

	it("deletes nothing when the Clerk instance does not allow self-deletion", async () => {
		deleteSelfEnabled = false;
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(result.current.error).toBe(
			"Deleting your whole AppElent account isn't available right now. You can still delete your Arcade Club data.",
		);
		expect(deleteMyData).not.toHaveBeenCalled();
	});

	it("asks Clerk to confirm an old sign-in before deleting anything", async () => {
		recentSignIn = false;
		checkAuthorization.mockImplementation(() => {
			// Nothing is deleted while Clerk's dialog is open.
			if (!recentSignIn) expect(deleteMyData).not.toHaveBeenCalled();
			return recentSignIn;
		});
		deleteMyData.mockResolvedValueOnce({ done: true });
		const { ok, result } = await runDeletion();
		expect(ok).toBe(true);
		expect(verifyPrompts).toBe(1);
		expect(checkAuthorization).toHaveBeenCalledWith({
			reverification: { level: "second_factor", afterMinutes: 5 },
		});
		expect(deleteUser).toHaveBeenCalledOnce();
		expect(result.current.error).toBe("");
	});

	it("deletes nothing and stays quiet when the person closes Clerk's dialog", async () => {
		recentSignIn = false;
		verifies = false;
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(verifyPrompts).toBe(1);
		expect(deleteMyData).not.toHaveBeenCalled();
		expect(deleteUser).not.toHaveBeenCalled();
		expect(result.current.error).toBe("");
	});

	it("deletes nothing when Clerk still finds the sign-in too old after its dialog", async () => {
		checkAuthorization.mockReturnValue(false);
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(deleteMyData).not.toHaveBeenCalled();
		expect(result.current.error).toMatch(/^To delete, sign in again first/);
	});

	it("refuses when another account signs in before the check", async () => {
		clerkUserId = "user_2";
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(deleteMyData).not.toHaveBeenCalled();
		expect(result.current.error).toBe(
			"You switched accounts. Sign in to the account you want to delete and try again.",
		);
	});

	it("says to sign in again to finish when Clerk refuses the account after the data", async () => {
		deleteMyData.mockResolvedValueOnce({ done: true });
		const refusal = {
			status: 403,
			errors: [{ code: "session_reverification_required" }],
		};
		// The window lapsed during the deletion, and the person closes the
		// dialog Clerk opens for the account.
		deleteUser.mockRejectedValue(refusal);
		verifies = false;
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(verifyPrompts).toBe(1);
		expect(signOut).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
		expect(result.current.error).toBe(
			"Your Arcade Club data is deleted, but your AppElent account isn't yet: it needs a recent sign-in. Sign in again, then delete your whole account again to finish.",
		);
	});

	it("says to sign in again to finish when Clerk still refuses after its dialog", async () => {
		deleteMyData.mockResolvedValueOnce({ done: true });
		deleteUser.mockRejectedValue({
			status: 403,
			errors: [{ code: "session_reverification_required" }],
		});
		const { ok, result } = await runDeletion();
		expect(ok).toBe(false);
		expect(deleteUser).toHaveBeenCalledTimes(2);
		expect(result.current.error).toMatch(/^Your Arcade Club data is deleted/);
	});
});
