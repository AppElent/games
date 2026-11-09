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

/** Games played in an online session. Word Links and Squad Surge play locally. */
export type SessionGameType = Exclude<GameType, "word-links" | "squad-surge">;

type SessionPolicy = {
	readonly joinMode: JoinMode;
	readonly authPolicy: AuthPolicy;
	/** A seat is proven by a secret the player's device keeps: participant ids are public. */
	readonly seatSecret?: true;
};

/**
 * How each game's sessions are hosted: how others get in, and whether they
 * need an account. A card table is solo or a room, as its host picks; it is
 * listed as a room.
 */
export const GAME_SESSION_POLICY = {
	"live-quiz": { joinMode: "room", authPolicy: "hostChoice" },
	backgammon: { joinMode: "challenge", authPolicy: "guestAllowed" },
	sudoku: { joinMode: "solo", authPolicy: "guestAllowed" },
	chess: { joinMode: "challenge", authPolicy: "guestAllowed" },
	hitster: { joinMode: "room", authPolicy: "hostChoice" },
	"connect-four": { joinMode: "challenge", authPolicy: "guestAllowed" },
	"signal-words": { joinMode: "room", authPolicy: "guestAllowed" },
	"bluff-dice": { joinMode: "room", authPolicy: "guestAllowed" },
	"card-games": {
		joinMode: "room",
		authPolicy: "guestAllowed",
		seatSecret: true,
	},
} as const satisfies Record<SessionGameType, SessionPolicy>;

/** Whether this game's seats carry a secret the player's device must keep. */
export function seatsCarrySecret(gameType: GameType) {
	const policy: SessionPolicy | undefined =
		GAME_SESSION_POLICY[gameType as SessionGameType];
	return policy?.seatSecret === true;
}
