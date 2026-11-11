// Which feature ships on which platform: the platform-parity standard
// (AppElent/developer-tools#63) and docs/adr/0002. Pure data with no imports,
// so it runs on web, Worker, Convex and Hermes. scripts/feature-manifest.test.ts
// checks it against the route files in CI.

export type Platform = "web" | "mobile";

/**
 * parity: on both platforms. exclusive: on one platform by design.
 * pending-port: meant for both platforms, on one for now.
 */
export type FeatureStatus = "parity" | "exclusive" | "pending-port";

/**
 * floor: required on both platforms (sign-in, account, export, deletion, ...).
 * share-target: someone without the app may open it from a link.
 * product: everything else.
 */
export type FeatureKind = "floor" | "share-target" | "product";

export interface Feature {
	/** Stable kebab-case id. */
	readonly id: string;
	readonly kind: FeatureKind;
	readonly status: FeatureStatus;
	/** Platforms that ship the feature today. Empty only for a pending-port feature that exists nowhere yet. */
	readonly platforms: readonly Platform[];
	/** Why the feature is not on both platforms. Required unless status is "parity". */
	readonly reason?: string;
	/** Web layout. Defaults to "responsive"; "large-screen" needs layoutReason. */
	readonly layout?: "responsive" | "large-screen";
	readonly layoutReason?: string;
	/**
	 * Route files owned by the feature, relative to each platform's route root
	 * and without extension. `*` matches within one path segment, `**` across
	 * segments: "recipes/**", "(app)/(tabs)/settings/*".
	 */
	readonly routes: {
		readonly web?: readonly string[];
		readonly mobile?: readonly string[];
	};
}

export const defineFeatures = <const T extends readonly Feature[]>(
	features: T,
): T => features;

const ADR = "docs/adr/0002-ship-every-game-on-web-and-mobile.md";
const TRIAGE =
	"Web-only for now: Eric decides whether to keep it and port it to the app (APP-49).";

/**
 * Every feature and the platforms it ships on today (ADR 0002). Each game in
 * `GAME_TYPES` is a product feature whose id is the game id; the app's
 * `APP_GAMES` holds exactly the games listed here with `mobile`.
 */
export const FEATURES = defineFeatures([
	// Floor
	{
		id: "sign-in",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["sign-in", "sign-up"],
			mobile: [
				"(auth)/sign-in",
				"(auth)/sign-in-code",
				"(auth)/sign-up",
				"(auth)/verify-email",
			],
		},
	},
	{
		id: "password-reset",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["forgot-password"], mobile: ["(auth)/reset"] },
	},
	{
		id: "account",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["account"], mobile: ["(tabs)/profile/index"] },
	},
	{
		id: "account-editing",
		kind: "floor",
		status: "pending-port",
		platforms: ["web"],
		reason:
			"The web edits the account name and changes the password on /account; the app shows the email and a display name kept on the phone (APP-46).",
		routes: {},
	},
	{
		id: "account-deletion",
		kind: "floor",
		status: "pending-port",
		platforms: ["mobile"],
		reason:
			"Only the app's Profile deletes an account (convex/account.ts deleteMyData); the web has no way to (APP-44).",
		routes: {},
	},
	{
		id: "data-export",
		kind: "floor",
		status: "pending-port",
		platforms: [],
		reason: "Neither platform exports a user's data yet (APP-45).",
		routes: {},
	},
	{
		id: "language",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {},
	},
	{
		id: "theme",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {},
	},
	{
		// The app opens the web page in an in-app browser from Profile.
		id: "privacy",
		kind: "floor",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["privacy"] },
	},

	// Share targets
	{
		// `/join?token=` and `?code=` links; the app also scans invite QR codes.
		id: "join",
		kind: "share-target",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["join"], mobile: ["(tabs)/join/index", "scan"] },
	},

	// Product
	{
		id: "home",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["index"], mobile: ["(tabs)/(play)/index"] },
	},
	{
		id: "about",
		kind: "product",
		status: "exclusive",
		platforms: ["web"],
		reason: `Introduces Arcade Club to visitors who do not have the app yet; the app's Profile shows its version instead (${ADR}).`,
		routes: { web: ["about"] },
	},
	{
		id: "dashboard",
		kind: "product",
		status: "exclusive",
		platforms: ["web"],
		reason: `Host admin is desk work: account stats, past results with CSV reports, and links to quiz sets and the workbench. Players on the app find their open games under Continue instead (${ADR}).`,
		routes: { web: ["dashboard/**"] },
	},
	{
		id: "workbench",
		kind: "product",
		status: "exclusive",
		platforms: ["web"],
		reason: `An authoring tool: paste generated JSON content, validate it and approve it. That is keyboard work, and the app is for playing (${ADR}).`,
		routes: { web: ["workbench/**"] },
	},

	// Games: one feature per GAME_TYPES id
	{
		id: "backgammon",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["backgammon/**"], mobile: ["backgammon/**"] },
	},
	{
		id: "sudoku",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: {
			web: ["sudoku/index", "sudoku/new", "sudoku/$sessionId"],
			mobile: ["sudoku/**"],
		},
	},
	{
		id: "sudoku-scan",
		kind: "product",
		status: "pending-port",
		platforms: ["web"],
		reason: "Only the web reads a puzzle from a photo (APP-47).",
		routes: { web: ["sudoku/scan"] },
	},
	{
		id: "sudoku-cloud-saves",
		kind: "product",
		status: "pending-port",
		platforms: ["web"],
		reason:
			"The web keeps puzzles in Convex; the app keeps them on the phone only, so neither sees the other's (APP-47).",
		routes: {},
	},
	{
		id: "hitster",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["hitster/**"], mobile: ["hitster/**"] },
	},
	{
		id: "card-games",
		kind: "product",
		status: "parity",
		platforms: ["web", "mobile"],
		routes: { web: ["cards/**"], mobile: ["cards/**"] },
	},
	{
		// Includes the quiz sets a host writes.
		id: "live-quiz",
		kind: "product",
		status: "pending-port",
		platforms: ["web"],
		reason: TRIAGE,
		routes: { web: ["quiz/**"] },
	},
	{
		id: "chess",
		kind: "product",
		status: "pending-port",
		platforms: ["web"],
		reason: TRIAGE,
		routes: { web: ["chess/**"] },
	},
	{
		id: "word-links",
		kind: "product",
		status: "pending-port",
		platforms: ["web"],
		reason: TRIAGE,
		routes: { web: ["word-links/**"] },
	},
	{
		id: "connect-four",
		kind: "product",
		status: "pending-port",
		platforms: ["web"],
		reason: TRIAGE,
		routes: { web: ["connect-four/**"] },
	},
	{
		id: "signal-words",
		kind: "product",
		status: "pending-port",
		platforms: ["web"],
		reason: TRIAGE,
		routes: { web: ["signal-words/**"] },
	},
	{
		id: "bluff-dice",
		kind: "product",
		status: "pending-port",
		platforms: ["web"],
		reason: TRIAGE,
		routes: { web: ["bluff-dice/**"] },
	},
	{
		id: "squad-surge",
		kind: "product",
		status: "pending-port",
		platforms: ["web"],
		reason: TRIAGE,
		routes: { web: ["squad-surge/**"] },
	},
]);
