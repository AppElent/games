/** Game identities shared by the web app, Convex and apps/mobile. */
export const GAME_TYPES = [
	"live-quiz",
	"backgammon",
	"sudoku",
	"chess",
	"hitster",
	"word-links",
	"connect-four",
	"signal-words",
	"bluff-dice",
	"squad-surge",
	"card-games",
] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const JOIN_MODES = ["room", "challenge", "solo"] as const;
export type JoinMode = (typeof JOIN_MODES)[number];

export const AUTH_POLICIES = [
	"guestAllowed",
	"signedInRequired",
	"hostChoice",
] as const;
export type AuthPolicy = (typeof AUTH_POLICIES)[number];
