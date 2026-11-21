import { gameErrorData } from "@arcadeclub/core/errors";
import { act, renderHook } from "@testing-library/react-native";
import { takeReturnTarget } from "../../../auth/return-target";
import { useDeleteAccount } from "./use-delete-account";

const mockDeleteMyData = jest.fn();
const mockDeleteUser = jest.fn();
const mockSignOut = jest.fn();
let mockUser: { id: string; deleteSelfEnabled: boolean } | null;
let mockSession: { id: string } | null;
/** Whether the session's sign-in is recent enough for Clerk. */
let mockRecentSignIn: boolean;

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
	useBackendAuthReady: () => ({ ready: true }),
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
		for (const mock of [mockDeleteMyData, mockDeleteUser, mockSignOut]) {
			mock.mockReset();
		}
		mockUser = { id: "user_1", deleteSelfEnabled: true };
		mockSession = { id: "sess_1" };
		mockRecentSignIn = true;
		mockDeleteMyData.mockResolvedValue({ done: true });
		mockDeleteUser.mockResolvedValue(undefined);
		mockSignOut.mockResolvedValue(undefined);
		takeReturnTarget("user_1");
	});

	it("does nothing without a signed-in user", async () => {
		mockUser = null;
		const { ok, result } = await run("app");
		expect(ok).toBe(false);
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		expect(result.current.error).toBeNull();
	});

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

	it("refuses an old sign-in before deleting anything and offers a new one", async () => {
		mockRecentSignIn = false;
		const { ok, result } = await run("app");
		expect(ok).toBe(false);
		expect(mockDeleteMyData).not.toHaveBeenCalled();
		expect(result.current.needsSignIn).toBe(true);
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
