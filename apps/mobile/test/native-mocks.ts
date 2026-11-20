/**
 * Native and network modules a render test can't load in Node. Registered for
 * every test by `jest.setup.ts`, and only as far as a screen under test needs:
 * add a mock here when a new render test fails to import a module, not before.
 *
 * Tests steer these, they do not re-mock them: `jest.mocked(useQuery)
 * .mockReturnValue(table)` decides what a Convex query returns.
 */

// Sentry starts at app launch (`observability/init`), never in a screen test.
jest.mock("@sentry/react-native", () => ({
	init: jest.fn(),
	captureException: jest.fn(),
	setTag: jest.fn(),
	setContext: jest.fn(),
	addBreadcrumb: jest.fn(),
	wrap: <T>(component: T) => component,
	feedbackIntegration: jest.fn(() => ({ options: {} })),
}));

// Router: screens read `useRouter` and set a header title through `Stack.Screen`.
jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	useRouter: () => ({
		push: jest.fn(),
		replace: jest.fn(),
		back: jest.fn(),
		dismiss: jest.fn(),
		dismissTo: jest.fn(),
	}),
	useLocalSearchParams: () => ({}),
}));

// Clerk: signed out. The real package boots clerk-js, which leaves handles open.
jest.mock("@clerk/expo", () => ({
	useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
	useAuth: () => ({ isLoaded: true, isSignedIn: false, getToken: jest.fn() }),
}));

jest.mock("expo-keep-awake", () => ({
	useKeepAwake: jest.fn(),
	activateKeepAwakeAsync: jest.fn(),
	deactivateKeepAwake: jest.fn(),
}));

jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(),
	notificationAsync: jest.fn(),
	selectionAsync: jest.fn(),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
	NotificationFeedbackType: {
		Success: "success",
		Warning: "warning",
		Error: "error",
	},
}));

// Convex: no deployment. Hooks return nothing until a test sets a query result.
jest.mock("convex/react", () => ({
	...jest.requireActual("convex/react"),
	useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }),
	useMutation: () => jest.fn(() => Promise.resolve(null)),
	useAction: () => jest.fn(() => Promise.resolve(null)),
}));

// The cached `useQuery` every screen reads through; see `src/convex/query-cache.tsx`.
jest.mock("../src/convex/query-cache", () => ({
	useQuery: jest.fn(),
}));
