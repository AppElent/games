import { deleteAccount } from "@arcadeclub/core/account-deletion";
import { gameErrorData } from "@arcadeclub/core/errors";
import { forgetAccountSaves } from "../../sudoku/saves/sudoku-save-store";
import { deletionSteps, needsSignInAgain } from "./delete-account-steps";

jest.mock("../../sudoku/saves/sudoku-save-store", () => ({
	forgetAccountSaves: jest.fn(),
}));

const account = { userId: "user_1", sessionId: "sess_1" };

function setup({ recent = true } = {}) {
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
	const steps = deletionSteps({ clerk, account, deleteBatch, signOut });
	return { calls, clerk, steps, deleteBatch, signOut };
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

	it("deletes nothing and asks to sign in again when the sign-in is old", async () => {
		const { calls, steps } = setup({ recent: false });
		const error = await failure(deleteAccount(steps));
		expect(gameErrorData(error)?.code).toBe("accountSignInFirst");
		expect(needsSignInAgain(error)).toBe(true);
		expect(calls).toEqual(["reload"]);
	});

	it("asks to sign in again to finish when Clerk refuses the user after the data", async () => {
		const { calls, clerk, steps, signOut } = setup();
		clerk.user.delete.mockRejectedValueOnce({
			status: 403,
			errors: [{ code: "session_reverification_required" }],
		});
		const error = await failure(deleteAccount(steps));
		expect(gameErrorData(error)?.code).toBe("accountSignInToFinish");
		expect(needsSignInAgain(error)).toBe(true);
		expect(calls).toEqual(["reload", "batch"]);
		expect(signOut).not.toHaveBeenCalled();
		expect(forgetAccountSaves).not.toHaveBeenCalled();
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
