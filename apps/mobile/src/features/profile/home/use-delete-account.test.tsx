import { gameErrorData } from "@arcadeclub/core/errors";
import { act, renderHook } from "@testing-library/react-native";
import { takeReturnTarget } from "../../../auth/return-target";
import { useDeleteAccount } from "./use-delete-account";

const mockDeleteMyData = jest.fn();
const mockDeleteUser = jest.fn();
const mockSignOut = jest.fn();
const mockPrepareFirstFactor = jest.fn();
const mockAttemptFirstFactor = jest.fn();
let mockUser: { id: string; deleteSelfEnabled: boolean } | null;
let mockSession: { id: string } | null;
/** Whether the session's sign-in is recent enough for Clerk. */
let mockRecentSignIn: boolean;
/** What Clerk offers to verify the session with. */
let mockFactors: Record<string, unknown>[];

jest.mock("@clerk/expo", () => ({
	useUser: () => ({ user: mockUser }),
	useAuth: () => ({ signOut: mockSignOut }),
	useClerk: () => ({
		get session() {
			return (
				mockSession && {
					...mockSession,
					checkAuthorization: () => mockRecentSignIn,
					reload: async () => {},
					startVerification: async () => ({
						status: "needs_first_factor",
						supportedFirstFactors: mockFactors,
					}),
					prepareFirstFactorVerification: mockPrepareFirstFactor,
					attemptFirstFactorVerification: mockAttemptFirstFactor,
				}
			);
		},
		get user() {
			return mockUser && { id: mockUser.id, delete: mockDeleteUser };
		},
	}),
}));
jest.mock("convex/react", () => ({
	useMutation: () => mockDeleteMyData,
}));
jest.mock("../../sessions/use-backend-auth-ready", () => ({
	useBackendAuthReady: () => ({
		isSignedIn: mockUser !== null,
		ready: mockUser !== null,
	}),
}));
jest.mock("../../sudoku/saves/sudoku-save-store", () => ({
	forgetAccountSaves: jest.fn(),
}));

async function run(scope: "app" | "account") {
	const hook = await renderHook(() => useDeleteAccount());
	let ok: boolean | undefined;
	await act(async () => {
		ok = await hook.result.current.deleteAccount(scope);
	});
	return { ok, result: hook.result };
}

describe("useDeleteAccount", () => {
	beforeEach(() => {
		for (const mock of [
			mockDeleteMyData,
			mockDeleteUser,
			mockSignOut,
			mockPrepareFirstFactor,
			mockAttemptFirstFactor,
		]) {
			mock.mockReset();
		}
		mockUser = { id: "user_1", deleteSelfEnabled: true };
		mockSession = { id: "sess_1" };
		mockRecentSignIn = true;
		mockFactors = [{ strategy: "passkey" }];
		mockDeleteMyData.mockResolvedValue({ done: true });
		mockDeleteUser.mockResolvedValue(undefined);
		mockSignOut.mockResolvedValue(undefined);
		mockPrepareFirstFactor.mockResolvedValue({});
		mockAttemptFirstFactor.mockImplementation(async () => {
			mockRecentSignIn = true;
			return { status: "complete" };
		});
		takeReturnTarget("user_1");
	});

	it.each(["app", "account"] as const)(
		"says the session ended and offers a sign-in when nobody is signed in (%s)",
		async (scope) => {
			mockUser = null;
			mockSession = null;
			const { ok, result } = await run(scope);
			expect(ok).toBe(false);
			expect(mockDeleteMyData).not.toHaveBeenCalled();
			expect(gameErrorData(result.current.error)?.code).toBe(
				"accountSessionEnded",
			);
			expect(result.current.needsSignIn).toBe(true);
			expect(result.current.unavailable).toBe(false);
			// The screen's Continue must be pressable for any of that to show.
			expect(result.current.ready).toBe(true);
			expect(result.current.signedOut).toBe(true);
		},
	);

	it("does nothing while a deletion is already running", async () => {
		let release!: () => void;
		mockDeleteMyData.mockReturnValue(
			new Promise((resolve) => {
				release = () => resolve({ done: true });
			}),
		);
		const hook = await renderHook(() => useDeleteAccount());
		let first!: Promise<boolean>;
		await act(async () => {
			first = hook.result.current.deleteAccount("app");
		});
		expect(hook.result.current.busy).toBe(true);
		let second: boolean | undefined;
		await act(async () => {
			second = await hook.result.current.deleteAccount("app");
		});
		expect(second).toBe(false);
		expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
		await act(async () => {
			release();
			await first;
		});
	});

	it("marks the whole-account deletion unavailable and deletes nothing", async () => {
		mockUser = { id: "user_1", deleteSelfEnabled: false };
		const { ok, result } = await run("account");
		expect(ok).toBe(false);
		expect(result.current.unavailable).toBe(true);
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		expect(mockDeleteUser).not.toHaveBeenCalled();
	});

	it("deletes the data only, then signs out, for the app scope", async () => {
		const { ok, result } = await run("app");
		expect(ok).toBe(true);
		expect(mockDeleteMyData).toHaveBeenCalledWith({
			expectedSubject: "user_1",
		});
		expect(mockDeleteUser).not.toHaveBeenCalled();
		expect(mockSignOut).toHaveBeenCalledTimes(1);
		expect(result.current.error).toBeNull();
	});

	it("deletes the data, then the user, then signs out, for the account scope", async () => {
		const { ok } = await run("account");
		expect(ok).toBe(true);
		expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
		expect(mockDeleteUser).toHaveBeenCalledTimes(1);
		expect(mockDeleteMyData.mock.invocationCallOrder[0]).toBeLessThan(
			mockDeleteUser.mock.invocationCallOrder[0],
		);
		expect(mockDeleteUser.mock.invocationCallOrder[0]).toBeLessThan(
			mockSignOut.mock.invocationCallOrder[0],
		);
	});

	it("refuses an old sign-in the sheet can't verify before deleting anything and offers a new one", async () => {
		mockRecentSignIn = false;
		const { ok, result } = await run("app");
		expect(ok).toBe(false);
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		expect(result.current.needsSignIn).toBe(true);
		expect(gameErrorData(result.current.error)?.code).toBe(
			"accountVerifyUnsupported",
		);
	});

	async function openSheet(
		factors: Record<string, unknown>[] = [{ strategy: "password" }],
		scope: "app" | "account" = "account",
	) {
		mockRecentSignIn = false;
		mockFactors = factors;
		const hook = await renderHook(() => useDeleteAccount());
		let deletion!: Promise<boolean>;
		await act(async () => {
			deletion = hook.result.current.deleteAccount(scope);
		});
		expect(hook.result.current.reverify.method).not.toBeNull();
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		return { deletion, result: hook.result };
	}

	const emailFactor = {
		strategy: "email_code",
		emailAddressId: "email_1",
		safeIdentifier: "ann@example.com",
		primary: true,
	};

	it("verifies an old sign-in in the sheet, then deletes without signing out first", async () => {
		const { deletion, result } = await openSheet();
		await act(async () => {
			await result.current.reverify.submit("secret");
			await deletion;
		});
		await expect(deletion).resolves.toBe(true);
		expect(mockDeleteUser).toHaveBeenCalledTimes(1);
		expect(mockSignOut).toHaveBeenCalledTimes(1);
		expect(mockDeleteUser.mock.invocationCallOrder[0]).toBeLessThan(
			mockSignOut.mock.invocationCallOrder[0],
		);
	});

	it("verifies with an emailed code and finishes the deletion", async () => {
		const { deletion, result } = await openSheet([emailFactor], "account");
		expect(result.current.reverify.method).toBe("code");
		expect(mockPrepareFirstFactor).toHaveBeenCalledWith({
			strategy: "email_code",
			emailAddressId: "email_1",
		});
		await act(async () => {
			await result.current.reverify.submit("424242");
			await deletion;
		});
		await expect(deletion).resolves.toBe(true);
		expect(mockAttemptFirstFactor).toHaveBeenCalledWith({
			strategy: "email_code",
			code: "424242",
		});
		expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
		expect(mockDeleteUser).toHaveBeenCalledTimes(1);
		expect(mockSignOut).toHaveBeenCalledTimes(1);
	});

	it("switches from password to code and back to password before deleting", async () => {
		const { deletion, result } = await openSheet(
			[{ strategy: "password" }, emailFactor],
			"app",
		);
		expect(result.current.reverify.method).toBe("password");
		await act(async () => {
			await result.current.reverify.sendCode();
		});
		expect(result.current.reverify.method).toBe("code");
		await act(async () => {
			result.current.reverify.usePassword();
		});
		expect(result.current.reverify.method).toBe("password");
		await act(async () => {
			await result.current.reverify.submit("secret");
			await deletion;
		});
		await expect(deletion).resolves.toBe(true);
		expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
		expect(mockDeleteUser).not.toHaveBeenCalled();
	});

	it("keeps the deletion waiting on wrong input until a valid one succeeds", async () => {
		const { deletion, result } = await openSheet([emailFactor], "account");
		mockAttemptFirstFactor.mockRejectedValueOnce({
			code: "api_response_error",
			errors: [{ code: "form_code_incorrect", message: "Incorrect" }],
		});
		await act(async () => {
			await result.current.reverify.submit("000000");
		});
		expect(result.current.reverify.errorKey).toBe("codeIncorrect");
		expect(result.current.reverify.method).toBe("code");
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		expect(mockDeleteUser).not.toHaveBeenCalled();

		await act(async () => {
			await result.current.reverify.submit("424242");
			await deletion;
		});
		await expect(deletion).resolves.toBe(true);
		expect(mockDeleteMyData).toHaveBeenCalledTimes(1);
		expect(mockDeleteUser).toHaveBeenCalledTimes(1);
	});

	it("refuses deletion when the account switches mid-verification", async () => {
		const { deletion, result } = await openSheet(
			[{ strategy: "password" }],
			"account",
		);
		let finish!: (value: unknown) => void;
		mockAttemptFirstFactor.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			}),
		);
		let submitted!: Promise<void>;
		await act(async () => {
			submitted = result.current.reverify.submit("secret");
		});
		mockUser = { id: "user_2", deleteSelfEnabled: true };
		await act(async () => {
			mockRecentSignIn = true;
			finish({ status: "complete" });
			await submitted;
			await deletion;
		});
		await expect(deletion).resolves.toBe(false);
		expect(gameErrorData(result.current.error)?.code).toBe("accountChanged");
		expect(result.current.reverify.method).toBeNull();
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		expect(mockDeleteUser).not.toHaveBeenCalled();
		expect(mockSignOut).not.toHaveBeenCalled();
	});

	it("deletes nothing and shows no error when the sheet is cancelled", async () => {
		const { deletion, result } = await openSheet();
		await act(async () => {
			result.current.reverify.cancel();
			await deletion;
		});
		await expect(deletion).resolves.toBe(false);
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		expect(mockDeleteUser).not.toHaveBeenCalled();
		expect(mockSignOut).not.toHaveBeenCalled();
		expect(result.current.error).toBeNull();
		expect(result.current.needsSignIn).toBe(false);
		expect(result.current.busy).toBe(false);
	});

	it("says the session ended, deleting nothing, when Clerk has no session", async () => {
		mockSession = null;
		const { ok, result } = await run("app");
		expect(ok).toBe(false);
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		expect(gameErrorData(result.current.error)?.code).toBe(
			"accountSessionEnded",
		);
		expect(result.current.needsSignIn).toBe(true);
	});

	it("signs out for a new sign-in, clears the refusal and remembers to come back", async () => {
		mockRecentSignIn = false;
		const { result } = await run("app");
		await act(async () => {
			await result.current.signInAgain();
		});
		expect(mockSignOut).toHaveBeenCalledTimes(1);
		expect(result.current.error).toBeNull();
		expect(takeReturnTarget("user_1")).toBe("/profile/delete-account");
	});

	it("forgets the return when signing out fails, and still throws", async () => {
		mockSignOut.mockRejectedValue(new Error("offline"));
		const { result } = await run("app");
		await act(async () => {
			await expect(result.current.signInAgain()).rejects.toThrow("offline");
		});
		expect(takeReturnTarget("user_1")).toBeNull();
	});
});
