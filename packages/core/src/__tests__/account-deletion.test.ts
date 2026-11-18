import { describe, expect, it, vi } from "vitest";
import {
	deleteAccount,
	hasRecentSignIn,
	isRecentSignInRefusal,
	NEEDS_RECENT_SIGN_IN,
} from "../account-deletion";
import { gameErrorData } from "../errors";

function steps(batches: boolean[]) {
	const calls: string[] = [];
	const deleteBatch = vi.fn(async () => {
		calls.push("batch");
		const done = batches.shift();
		if (done === undefined) throw new Error("no batches left");
		return { done };
	});
	return {
		calls,
		deleteBatch,
		deleteUser: vi.fn(async () => {
			calls.push("user");
		}),
		signOut: vi.fn(async () => {
			calls.push("signOut");
		}),
	};
}

describe("deleteAccount", () => {
	it("repeats batches until done, then deletes the user and signs out", async () => {
		const s = steps([false, false, true]);
		await expect(deleteAccount(s)).resolves.toBe(true);
		expect(s.calls).toEqual(["batch", "batch", "batch", "user", "signOut"]);
	});

	it("keeps the user when a batch fails, so a rerun can resume", async () => {
		const s = steps([false]);
		const refusal = Object.assign(new Error("refused"), {
			data: { code: "accountInActiveGame" },
		});
		s.deleteBatch.mockImplementationOnce(async () => {
			throw refusal;
		});
		await expect(deleteAccount(s)).rejects.toBe(refusal);
		expect(s.deleteUser).not.toHaveBeenCalled();
		expect(s.signOut).not.toHaveBeenCalled();

		s.deleteBatch.mockImplementation(async () => ({ done: true }));
		await deleteAccount(s);
		expect(s.deleteUser).toHaveBeenCalledOnce();
		expect(s.signOut).toHaveBeenCalledOnce();
	});

	it("still succeeds when signing out fails after the user is gone", async () => {
		const s = steps([true]);
		s.signOut.mockRejectedValueOnce(new Error("no session"));
		await expect(deleteAccount(s)).resolves.toBe(true);
		expect(s.deleteUser).toHaveBeenCalledOnce();
	});

	it("does not sign out when deleting the user fails", async () => {
		const s = steps([true]);
		s.deleteUser.mockRejectedValueOnce(new Error("clerk down"));
		await expect(deleteAccount(s)).rejects.toThrow("clerk down");
		expect(s.signOut).not.toHaveBeenCalled();
	});

	it("confirms a recent sign-in before the first batch", async () => {
		const s = steps([true]);
		const confirmRecentSignIn = vi.fn(async () => {
			s.calls.push("confirm");
			return true;
		});
		await deleteAccount({ ...s, confirmRecentSignIn });
		expect(s.calls).toEqual(["confirm", "batch", "user", "signOut"]);
	});

	it("deletes nothing when the person cancels the sign-in check", async () => {
		const s = steps([true]);
		await expect(
			deleteAccount({ ...s, confirmRecentSignIn: async () => false }),
		).resolves.toBe(false);
		expect(s.calls).toEqual([]);
	});

	it("deletes nothing when the sign-in is too old", async () => {
		const s = steps([true]);
		const stale = Object.assign(new Error("stale"), {
			data: { code: "accountSignInFirst" },
		});
		await expect(
			deleteAccount({
				...s,
				confirmRecentSignIn: async () => {
					throw stale;
				},
			}),
		).rejects.toBe(stale);
		expect(s.calls).toEqual([]);
	});

	it.each([
		["throws Clerk's API refusal", "throw"],
		["returns the reverification hint", "hint"],
		["throws a cancelled verify dialog", "cancel"],
	])(
		"asks to sign in again to finish when Clerk %s at the end",
		async (_, how) => {
			const s = steps([true]);
			s.deleteUser.mockImplementationOnce(async () => {
				if (how === "hint") return NEEDS_RECENT_SIGN_IN as never;
				throw how === "cancel"
					? { code: "reverification_cancelled" }
					: {
							status: 403,
							errors: [{ code: "session_reverification_required" }],
						};
			});
			const caught = await deleteAccount(s).catch((error: unknown) => error);
			expect(gameErrorData(caught)?.code).toBe("accountSignInToFinish");
			expect(s.signOut).not.toHaveBeenCalled();
		},
	);
});

describe("isRecentSignInRefusal", () => {
	it("ignores other failures and successes", () => {
		expect(isRecentSignInRefusal(undefined)).toBe(false);
		expect(isRecentSignInRefusal(new Error("network"))).toBe(false);
		expect(
			isRecentSignInRefusal({ errors: [{ code: "form_param_nil" }] }),
		).toBe(false);
		expect(isRecentSignInRefusal({ clerk_error: { reason: "other" } })).toBe(
			false,
		);
	});
});

describe("hasRecentSignIn", () => {
	const account = { userId: "user_1", sessionId: "sess_1" };
	function clerk(recent: boolean) {
		const live = {
			user: { id: "user_1" },
			session: {
				id: "sess_1",
				reload: vi.fn(async () => {}),
				checkAuthorization: vi.fn(() => recent),
			},
		};
		return live;
	}

	it("reloads the session, then checks the strict window with room to spare", async () => {
		const live = clerk(true);
		await expect(hasRecentSignIn(live, account)).resolves.toBe(true);
		expect(live.session.reload).toHaveBeenCalledOnce();
		expect(live.session.checkAuthorization).toHaveBeenCalledWith({
			reverification: { level: "second_factor", afterMinutes: 5 },
		});
		expect(live.session.reload.mock.invocationCallOrder[0]).toBeLessThan(
			live.session.checkAuthorization.mock.invocationCallOrder[0],
		);
	});

	it("reports an old sign-in", async () => {
		await expect(hasRecentSignIn(clerk(false), account)).resolves.toBe(false);
	});

	it("refuses when another account is signed in, also after the reload", async () => {
		const other = clerk(true);
		other.user.id = "user_2";
		const before = await hasRecentSignIn(other, account).catch((e) => e);
		expect(gameErrorData(before)?.code).toBe("accountChanged");

		const switching = clerk(true);
		switching.session.reload.mockImplementationOnce(async () => {
			switching.user.id = "user_2";
		});
		const after = await hasRecentSignIn(switching, account).catch((e) => e);
		expect(gameErrorData(after)?.code).toBe("accountChanged");
		expect(switching.session.checkAuthorization).not.toHaveBeenCalled();
	});
});
