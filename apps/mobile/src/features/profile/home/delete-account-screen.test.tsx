import { messages } from "@arcadeclub/core/messages";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { renderScreen } from "../../../../test/render-screen";
import { takeReturnTarget } from "../../../auth/return-target";
import { DeleteAccountScreen } from "./delete-account-screen";

const copy = messages.en.profile.deleteAccount;
const mockRouter = { push: jest.fn(), dismissTo: jest.fn() };
const mockSignOut = jest.fn();
let mockUser: { id: string; deleteSelfEnabled: boolean } | null;

jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useRouter: () => mockRouter,
}));
jest.mock("@clerk/expo", () => ({
	useUser: () => ({ user: mockUser }),
	useAuth: () => ({ isSignedIn: mockUser !== null, signOut: mockSignOut }),
	// The session ended: Clerk has none, whether or not it still has the user.
	useClerk: () => ({ session: null, user: mockUser }),
}));
jest.mock("convex/react", () => ({
	useConvexAuth: () => ({ isLoading: false, isAuthenticated: true }),
	useMutation: () => jest.fn(),
}));

/** Chooses to delete, and confirms it in the native alert. */
async function confirmDeletion() {
	await renderScreen(<DeleteAccountScreen />);
	await fireEvent.press(screen.getByTestId("delete-account-continue"));
	const buttons = jest.mocked(Alert.alert).mock.calls[0]?.[2];
	buttons?.find(({ style }) => style === "destructive")?.onPress?.();
	expect(
		await screen.findByText(messages.en.serverErrors.accountSessionEnded),
	).toBeTruthy();
}

describe("DeleteAccountScreen once the session ended", () => {
	beforeEach(() => {
		jest
			.spyOn(Alert, "alert")
			.mockReset()
			.mockImplementation(() => {});
		for (const mock of [mockRouter.push, mockRouter.dismissTo, mockSignOut]) {
			mock.mockReset();
		}
		mockSignOut.mockResolvedValue(undefined);
		mockUser = { id: "user_1", deleteSelfEnabled: true };
		takeReturnTarget("user_1");
	});

	it("signs in over this screen when nobody is signed in", async () => {
		mockUser = null;
		await confirmDeletion();
		await fireEvent.press(screen.getByLabelText(copy.signInAgain));
		expect(mockRouter.push).toHaveBeenCalledWith("/sign-in");
		expect(mockRouter.dismissTo).not.toHaveBeenCalled();
		expect(mockSignOut).not.toHaveBeenCalled();

		// Closing that sign-in leaves the button usable.
		await fireEvent.press(screen.getByLabelText(copy.signInAgain));
		expect(mockRouter.push).toHaveBeenCalledTimes(2);
	});

	it("signs the remaining user out first, to come back here", async () => {
		await confirmDeletion();
		await fireEvent.press(screen.getByLabelText(copy.signInAgain));
		await waitFor(() =>
			expect(mockRouter.push).toHaveBeenCalledWith("/sign-in"),
		);
		expect(mockSignOut).toHaveBeenCalledTimes(1);
		expect(takeReturnTarget("user_1")).toBe("/profile/delete-account");
	});
});
