import {
	type DeletionScope,
	deleteAccount,
} from "@arcadeclub/core/account-deletion";
import { GameRuleError, gameErrorData } from "@arcadeclub/core/errors";
import { reportError } from "../../../observability/report";
import { forgetAccountSaves } from "../../sudoku/saves/sudoku-save-store";
import type { ReverifyOutcome } from "../reverify/use-reverify";
import { deletionSteps, needsSignInAgain } from "./delete-account-steps";

jest.mock("../../../observability/report", () => ({ reportError: jest.fn() }));
jest.mock("../../sudoku/saves/sudoku-save-store", () => ({
	forgetAccountSaves: jest.fn(),
}));

const account = { userId: "user_1", sessionId: "sess_1" };

function setup({
	recent = true,
	scope = "account",
	outcome = "verified",
}: {
	recent?: boolean;
	scope?: DeletionScope;
	/** How the verify sheet ends. */
	outcome?: ReverifyOutcome;
} = {}) {
	const calls: string[] = [];
	const clerk = {
		user: {
			id: "user_1",
			delete: jest.fn(async (): Promise<unknown> => {
				calls.push("user");
				return undefined;
			}),
		},
		session: {
			id: "sess_1",
			reload: jest.fn(async () => {
				calls.push("reload");
			}),
			checkAuthorization: jest.fn(() => recent),
		},
	};
	const deleteBatch = jest.fn(async () => {
		calls.push("batch");
		return { done: true };
	});
	const signOut = jest.fn(async () => {
		calls.push("signOut");
	});
	const reverify = jest.fn(async (): Promise<ReverifyOutcome> => {
		calls.push("reverify");
		return outcome;
	});
	const steps = deletionSteps({
		clerk,
		account,
		scope,
		deleteBatch,
		reverify,
		signOut,
	});
	return { calls, clerk, steps, deleteBatch, reverify, signOut };
}

async function failure(run: Promise<unknown>) {
	return run.then(
		() => null,
		(error: unknown) => error,
	);
}

afterEach(() => jest.clearAllMocks());

describe("deletionSteps", () => {
	it("checks a fresh sign-in, deletes the data, the user, the phone's saves, then signs out", async () => {
		const { calls, clerk, steps } = setup();
		await expect(deleteAccount(steps)).resolves.toBe(true);
		expect(calls).toEqual(["reload", "batch", "user", "signOut"]);
		expect(clerk.session.checkAuthorization).toHaveBeenCalledWith({
			reverification: { level: "second_factor", afterMinutes: 5 },
		});
		expect(forgetAccountSaves).toHaveBeenCalledWith("user_1");
	});

	it("deletes only Arcade Club's data and the phone's saves, keeps the Clerk user, then signs out", async () => {
		const { calls, clerk, steps } = setup({ scope: "app" });
		await expect(deleteAccount(steps)).resolves.toBe(true);
		expect(calls).toEqual(["reload", "batch", "signOut"]);
		expect(clerk.user.delete).not.toHaveBeenCalled();
		expect(forgetAccountSaves).toHaveBeenCalledWith("user_1");
	});

	it.each([
		["app", ["reload", "reverify", "reload", "batch", "signOut"]],
		["account", ["reload", "reverify", "reload", "batch", "user", "signOut"]],
	] as const)(
		"verifies an old sign-in, then deletes (%s)",
		async (scope, order) => {
			const { calls, clerk, steps } = setup({ scope });
			clerk.session.checkAuthorization.mockReturnValueOnce(false);
			await expect(deleteAccount(steps)).resolves.toBe(true);
			expect(calls).toEqual(order);
		},
	);

	it.each(["app", "account"] as const)(
		"deletes nothing when the sheet is cancelled (%s)",
		async (scope) => {
			const { calls, steps } = setup({
				scope,
				recent: false,
				outcome: "cancelled",
			});
			await expect(deleteAccount(steps)).resolves.toBe(false);
			expect(calls).toEqual(["reload", "reverify"]);
		},
	);

	it("deletes nothing and offers signing in again when the sheet can't verify the account", async () => {
		const { calls, steps } = setup({ recent: false, outcome: "unsupported" });
		const error = await failure(deleteAccount(steps));
		expect(gameErrorData(error)?.code).toBe("accountVerifyUnsupported");
		expect(needsSignInAgain(error)).toBe(true);
		expect(calls).toEqual(["reload", "reverify"]);
	});

	it("deletes nothing and offers no sign-in an unsupported second factor can't finish", async () => {
		const { calls, steps } = setup({
			recent: false,
			outcome: "noSecondFactor",
		});
		const error = await failure(deleteAccount(steps));
		expect(gameErrorData(error)?.code).toBe("accountSecondFactorUnsupported");
		expect(needsSignInAgain(error)).toBe(false);
		expect(calls).toEqual(["reload", "reverify"]);
	});

	it("deletes nothing when Clerk still finds the sign-in old after the sheet", async () => {
		const { calls, steps } = setup({ recent: false });
		const error = await failure(deleteAccount(steps));
		expect(gameErrorData(error)?.code).toBe("accountSignInFirst");
		expect(needsSignInAgain(error)).toBe(true);
		expect(calls).toEqual(["reload", "reverify", "reload"]);
	});

	const refusal = {
		status: 403,
		errors: [{ code: "session_reverification_required" }],
	};

	it("verifies and finishes when Clerk refuses the user after the data", async () => {
		const { calls, clerk, steps } = setup();
		clerk.user.delete.mockRejectedValueOnce(refusal);
		await expect(deleteAccount(steps)).resolves.toBe(true);
		expect(calls).toEqual(["reload", "batch", "reverify", "user", "signOut"]);
	});

	it.each([
		["cancelled", "accountDeleteAgain", false],
		["noSecondFactor", "accountDeleteAgain", false],
		["unsupported", "accountSignInToFinish", true],
		// Verified, but Clerk refuses again.
		["verified", "accountSignInToFinish", true],
	] as const)(
		"says the data is gone but the user isn't when that sheet ends %s",
		async (outcome, code, signInAgain) => {
			const { calls, clerk, steps, signOut } = setup({ outcome });
			clerk.user.delete.mockRejectedValue(refusal);
			const error = await failure(deleteAccount(steps));
			expect(gameErrorData(error)?.code).toBe(code);
			expect(needsSignInAgain(error)).toBe(signInAgain);
			expect(calls).toEqual(["reload", "batch", "reverify"]);
			expect(signOut).not.toHaveBeenCalled();
			expect(forgetAccountSaves).not.toHaveBeenCalled();
		},
	);

	it("says the data is gone but the user isn't when that sheet cannot open", async () => {
		const { clerk, steps, reverify, signOut } = setup();
		const offline = new Error("Network request failed");
		clerk.user.delete.mockRejectedValueOnce(refusal);
		reverify.mockRejectedValueOnce(offline);
		const error = await failure(deleteAccount(steps));
		expect(gameErrorData(error)?.code).toBe("accountDeleteAgain");
		expect(reportError).toHaveBeenCalledWith(offline);
		expect(signOut).not.toHaveBeenCalled();
	});

	it.each(["accountSignInFirst", "accountSessionEnded"] as const)(
		"says the data is gone when that sheet rejects with %s",
		async (code) => {
			const { clerk, steps, reverify, signOut } = setup();
			clerk.user.delete.mockRejectedValueOnce(refusal);
			reverify.mockRejectedValueOnce(new GameRuleError(code));
			const error = await failure(deleteAccount(steps));
			expect(gameErrorData(error)?.code).toBe("accountSignInToFinish");
			expect(needsSignInAgain(error)).toBe(true);
			expect(signOut).not.toHaveBeenCalled();
		},
	);

	it("refuses to finish on another account that signed in during the sheet", async () => {
		const { clerk, steps, reverify } = setup();
		clerk.user.delete.mockRejectedValueOnce(refusal);
		reverify.mockImplementationOnce(async () => {
			clerk.user.id = "user_2";
			return "verified";
		});
		const error = await failure(deleteAccount(steps));
		expect(gameErrorData(error)?.code).toBe("accountChanged");
		expect(clerk.user.delete).toHaveBeenCalledTimes(1);
	});

	it("refuses when another account is signed in by the time the user is deleted", async () => {
		const { clerk, steps } = setup();
		const batch = steps.deleteBatch;
		const switching = {
			...steps,
			deleteBatch: async () => {
				clerk.user.id = "user_2";
				return batch();
			},
		};
		const error = await failure(deleteAccount(switching));
		expect(gameErrorData(error)?.code).toBe("accountChanged");
		expect(needsSignInAgain(error)).toBe(false);
		expect(clerk.user.delete).not.toHaveBeenCalled();
	});

	it("offers signing in again only for the sign-in refusals", () => {
		expect(needsSignInAgain(null)).toBe(false);
		expect(needsSignInAgain(new Error("network"))).toBe(false);
		expect(needsSignInAgain({ data: { code: "accountInActiveGame" } })).toBe(
			false,
		);
	});
});
