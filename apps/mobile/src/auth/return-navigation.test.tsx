/**
 * The two halves of a return target in the real layouts: the root navigator
 * takes it once someone is signed in, the sign-in modal drops it when it
 * leaves without a sign-in. The mocks sit at the native and network edge.
 */
import { act, render } from "@testing-library/react-native";
import RootLayout from "../../app/_layout";
import AuthLayout from "../../app/(auth)/_layout";
import { renderScreen } from "../../test/render-screen";
import { returnAfterSignIn, takeReturnTarget } from "./return-target";

const mockNavigate = jest.fn();
const mockRouter = { navigate: mockNavigate, replace: jest.fn() };
let mockAuth: { isLoaded: boolean; isSignedIn: boolean; userId: string | null };
const mockAuthChanged = new Set<() => void>();
const mockListeners = new Map<string, Set<() => void>>();
const mockNavigation = {
	canGoBack: () => true,
	// Closing the modal removes it, as the native swipe does.
	goBack: jest.fn(() => mockEmit("removed")),
	addListener: (name: string, listener: () => void) => {
		const listeners = mockListeners.get(name) ?? new Set();
		mockListeners.set(name, listeners.add(listener));
		return () => {
			listeners.delete(listener);
		};
	},
};

function mockEmit(name: string) {
	for (const listener of mockListeners.get(name) ?? []) listener();
}

jest.mock("@clerk/expo", () => {
	const { useSyncExternalStore } =
		jest.requireActual<typeof import("react")>("react");
	const subscribe = (changed: () => void) => {
		mockAuthChanged.add(changed);
		return () => mockAuthChanged.delete(changed);
	};
	return {
		ClerkProvider: ({ children }: { children: unknown }) => children,
		useAuth: () => useSyncExternalStore(subscribe, () => mockAuth),
	};
});
jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: undefined }));
jest.mock("expo-router", () => {
	const Stack = () => null;
	Stack.Screen = () => null;
	return {
		DarkTheme: { colors: {} },
		DefaultTheme: { colors: {} },
		ErrorBoundary: () => null,
		Stack,
		ThemeProvider: ({ children }: { children: unknown }) => children,
		useNavigation: () => mockNavigation,
		useRouter: () => mockRouter,
		useSegments: () => [],
	};
});
jest.mock("expo-splash-screen", () => ({
	preventAutoHideAsync: jest.fn(),
	hideAsync: jest.fn(),
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("expo-system-ui", () => ({
	setBackgroundColorAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("react-native-gesture-handler", () => ({
	GestureHandlerRootView: ({ children }: { children: unknown }) => children,
}));
jest.mock("react-native-safe-area-context", () => ({
	...jest.requireActual("react-native-safe-area-context"),
	// The real one renders nothing until the native side measures.
	SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock("../ui/orientation", () => ({ lockPortrait: jest.fn() }));
jest.mock("./config", () => ({ publishableKey: "pk_test_x" }));
jest.mock("../convex/provider", () => ({
	AppConvexProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock("../convex/query-cache", () => ({
	AppQueryCacheProvider: ({ children }: { children: unknown }) => children,
}));
jest.mock("../features/sudoku/saves/use-sudoku-cloud-sync", () => ({
	useSudokuCloudSync: jest.fn(),
}));

const signedOut = { isLoaded: true, isSignedIn: false, userId: null };
const signedInAs = (userId: string) => ({
	isLoaded: true,
	isSignedIn: true,
	userId,
});

async function setAuth(auth: typeof mockAuth) {
	await act(async () => {
		mockAuth = auth;
		for (const changed of mockAuthChanged) changed();
	});
}

beforeEach(() => {
	mockNavigate.mockClear();
	mockNavigation.goBack.mockClear();
	mockListeners.clear();
	takeReturnTarget("nobody");
	mockAuth = signedOut;
});

describe("RootNavigator", () => {
	it("goes back to where the sign-in started, once", async () => {
		returnAfterSignIn("/profile/change-password", "user_1");
		await render(<RootLayout />);
		expect(mockNavigate).not.toHaveBeenCalled();

		await setAuth(signedInAs("user_1"));
		expect(mockNavigate).toHaveBeenCalledTimes(1);
		expect(mockNavigate).toHaveBeenCalledWith("/profile/change-password");

		await setAuth(signedOut);
		await setAuth(signedInAs("user_1"));
		expect(mockNavigate).toHaveBeenCalledTimes(1);
	});

	it("waits until Clerk has loaded", async () => {
		returnAfterSignIn("/profile/delete-account", "user_1");
		mockAuth = { ...signedInAs("user_1"), isLoaded: false };
		await render(<RootLayout />);
		expect(mockNavigate).not.toHaveBeenCalled();

		await setAuth(signedInAs("user_1"));
		expect(mockNavigate).toHaveBeenCalledWith("/profile/delete-account");
	});

	it("stays put for another account, or when nothing was asked for", async () => {
		returnAfterSignIn("/profile/delete-account", "user_1");
		mockAuth = signedInAs("user_2");
		await render(<RootLayout />);
		await setAuth(signedInAs("user_1"));
		expect(mockNavigate).not.toHaveBeenCalled();
	});
});

describe("the sign-in modal", () => {
	it("drops the return target when it is swiped closed", async () => {
		returnAfterSignIn("/profile/change-password", "user_1");
		const modal = await renderScreen(<AuthLayout />);
		// The router removes the route and unmounts the layout first.
		await act(async () => {
			modal.unmount();
			mockEmit("removed");
		});
		expect(takeReturnTarget("user_1")).toBeNull();
		expect(mockListeners.get("removed")?.size).toBe(0);
	});

	it("keeps the return target when a sign-in closes it", async () => {
		returnAfterSignIn("/profile/change-password", "user_1");
		await renderScreen(<AuthLayout />);
		await setAuth(signedInAs("user_1"));
		expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
		expect(takeReturnTarget("user_1")).toBe("/profile/change-password");
	});
});
