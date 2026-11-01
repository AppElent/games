/**
 * What every test needs before a module loads: the public env the providers
 * read at import time, and in-memory stand-ins for the device stores so a
 * preference written by one screen is read back by the next.
 */
process.env.EXPO_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_jest";

// Gesture Handler installs UI-runtime bindings at import time, but Worklets'
// web build (the one Jest resolves) throws from `getUIRuntimeHolder`.
jest.mock("react-native-worklets", () => ({
	...jest.requireActual("react-native-worklets"),
	getUIRuntimeHolder: () => ({}),
}));

jest.mock("expo-sqlite/kv-store", () => {
	const store = new Map<string, string>();
	return {
		__esModule: true,
		default: {
			getItemSync: (key: string) => store.get(key) ?? null,
			setItemSync: (key: string, value: string) => {
				store.set(key, value);
			},
			removeItemSync: (key: string) => {
				store.delete(key);
			},
			clearSync: () => store.clear(),
		},
	};
});

// A device set to English: a test that expects Dutch has to ask for it.
jest.mock("expo-localization", () => ({
	getLocales: () => [{ languageTag: "en-GB", languageCode: "en" }],
}));

jest.mock("expo-haptics", () => ({
	selectionAsync: jest.fn(() => Promise.resolve()),
	impactAsync: jest.fn(() => Promise.resolve()),
	notificationAsync: jest.fn(() => Promise.resolve()),
	ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
	NotificationFeedbackType: {
		Success: "success",
		Warning: "warning",
		Error: "error",
	},
}));

jest.mock("@clerk/expo", () => ({
	ClerkProvider: ({ children }: { children: unknown }) => children,
	useAuth: jest.fn(() => ({
		isLoaded: true,
		isSignedIn: false,
		userId: null,
		signOut: jest.fn(),
		getToken: jest.fn().mockResolvedValue(null),
	})),
	useUser: jest.fn(() => ({ isLoaded: true, isSignedIn: false, user: null })),
}));

jest.mock("@clerk/expo/token-cache", () => ({ tokenCache: undefined }));
