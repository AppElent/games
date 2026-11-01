/**
 * Jest, and only inside `apps/mobile`. The rest of the repo runs Vitest; the
 * exception is jest-expo, the only maintained preset that transforms
 * Flow-typed `react-native`/`expo-*` sources and supplies native mocks.
 *
 * Under pnpm, packages live at `node_modules/.pnpm/<name>@<v>/node_modules/<name>`,
 * so the allow-list matches the package name anywhere in the path rather
 * than right after the first `node_modules/`.
 */
const mustTransform = [
	"@arcadeclub",
	"@expo",
	"@react-native",
	"@react-navigation",
	"@testing-library",
	"convex-helpers",
	"expo",
	"expo-.*",
	"jest-expo",
	"react-native",
	"react-native-.*",
	"standard-navigation",
].join("|");

module.exports = {
	preset: "jest-expo",
	setupFiles: [
		require.resolve("react-native-gesture-handler/jestSetup"),
		"<rootDir>/jest.setup.ts",
	],
	// Reanimated 4 / Worklets (SDK 58) load JSI-only builds unless Jest
	// resolves their test entry points through Reanimated's resolver.
	resolver: require.resolve("react-native-reanimated/jest/resolver"),
	testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/src/**/*.test.tsx"],
	transformIgnorePatterns: [
		`node_modules[\\\\/](?!([^\\\\/]+[\\\\/])*(${mustTransform})[\\\\/])`,
	],
};
