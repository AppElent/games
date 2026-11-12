import { describe, expect, it, vi } from "vitest";
import { deleteAccount } from "../account-deletion";

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
		await deleteAccount(s);
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
		await expect(deleteAccount(s)).resolves.toBeUndefined();
		expect(s.deleteUser).toHaveBeenCalledOnce();
	});

	it("does not sign out when deleting the user fails", async () => {
		const s = steps([true]);
		s.deleteUser.mockRejectedValueOnce(new Error("clerk down"));
		await expect(deleteAccount(s)).rejects.toThrow("clerk down");
		expect(s.signOut).not.toHaveBeenCalled();
	});
});
