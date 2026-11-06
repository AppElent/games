/** Game identities shared by the web app, Convex and apps/mobile. */
export type GameType =
	| "live-quiz"
	| "backgammon"
	| "sudoku"
	| "chess"
	| "hitster"
	| "word-links"
	| "connect-four"
	| "signal-words"
	| "bluff-dice"
	| "squad-surge"
	| "card-games";

export type JoinMode = "room" | "challenge" | "solo";
export type AuthPolicy = "guestAllowed" | "signedInRequired" | "hostChoice";
