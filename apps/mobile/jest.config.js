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
	"convex-helpers",
	"expo",
	"expo-.*",
	"jest-expo",
	"react-native",
	"react-native-.*",
	"standard-navigation",
].join("|");

const preset = require("jest-expo/jest-preset");

module.exports = {
	preset: "jest-expo",
	// `src/updates/ota-label.mjs` is a copy of a shared ES module; compile it
	// like the app's own sources.
	transform: { "\\.mjs$": preset.transform["\\.[jt]sx?$"] },
	setupFiles: ["<rootDir>/jest.setup.ts"],
	testMatch: ["<rootDir>/src/**/*.test.ts"],
	transformIgnorePatterns: [
		`node_modules[\\\\/](?!([^\\\\/]+[\\\\/])*(${mustTransform})[\\\\/])`,
	],
};
