export const HITSTER_MODES = [
	"instant",
	"original",
	"pro",
	"expert",
	"coop",
] as const;
export type HitsterMode = (typeof HITSTER_MODES)[number];

export const HITSTER_PLAYBACK_MODES = ["hostDevice", "preview"] as const;
export type HitsterPlaybackMode = (typeof HITSTER_PLAYBACK_MODES)[number];

export const HITSTER_PHASES = [
	"lobby",
	"nowPlaying",
	"reveal",
	"finished",
] as const;

export type HitsterModeConfig = {
	startTokens: number;
	tokenCap: number;
	/** Original mode: artist + title bonus earns a token. */
	earnTokens: boolean;
	/** Card is only won when artist + title are also correct. */
	needsArtistTitle: boolean;
	/** Card is only won when the exact year is also correct. */
	needsYear: boolean;
	stealsEnabled: boolean;
	/** Cooperative shared timeline. */
	shared: boolean;
};

const MODE_CONFIGS: Record<HitsterMode, HitsterModeConfig> = {
	instant: {
		startTokens: 0,
		tokenCap: 0,
		earnTokens: false,
		needsArtistTitle: false,
		needsYear: false,
		stealsEnabled: false,
		shared: false,
	},
	original: {
		startTokens: 2,
		tokenCap: 5,
		earnTokens: true,
		needsArtistTitle: false,
		needsYear: false,
		stealsEnabled: true,
		shared: false,
	},
	pro: {
		startTokens: 5,
		tokenCap: 5,
		earnTokens: false,
		needsArtistTitle: true,
		needsYear: false,
		stealsEnabled: true,
		shared: false,
	},
	expert: {
		startTokens: 3,
		tokenCap: 5,
		earnTokens: false,
		needsArtistTitle: true,
		needsYear: true,
		stealsEnabled: true,
		shared: false,
	},
	coop: {
		startTokens: 5,
		tokenCap: 5,
		earnTokens: false,
		needsArtistTitle: false,
		needsYear: false,
		stealsEnabled: false,
		shared: true,
	},
};

export function getHitsterModeConfig(mode: HitsterMode): HitsterModeConfig {
	return MODE_CONFIGS[mode];
}

/** What a new-game form offers and starts on. */
export const HITSTER_TARGET_OPTIONS = [5, 8, 10, 12, 15] as const;
export const HITSTER_TIMER_OPTIONS = [0, 30, 60, 90] as const;
export const HITSTER_SETUP_DEFAULTS = {
	mode: "original",
	packId: "normal",
	targetCards: 10,
	timer: 0,
	playbackMode: "hostDevice",
} as const;

/** What the server accepts for cards to win. */
export const HITSTER_TARGET_CARDS_RANGE = { min: 3, max: 20 };
/** Tracks a pack must have beyond the target, for start cards and missed rounds. */
export const HITSTER_SPARE_TRACKS = 5;

export function hitsterMinPlayers(config: HitsterModeConfig) {
	return config.shared ? 1 : 2;
}

/** Whether an answer form asks for artist and title. */
export function hitsterAsksArtistTitle(
	config: HitsterModeConfig,
	forSteal: boolean,
) {
	return config.needsArtistTitle || (!forSteal && config.earnTokens);
}

export function hitsterSecondsLeft(
	seconds: number,
	startedAt: number,
	now: number,
) {
	return Math.max(0, seconds - Math.floor((now - startedAt) / 1000));
}

/** The timeline a participant plays on: the shared one in co-op. */
export function hitsterTimelineFor<T extends { participantId?: string }>(
	state: { mode: HitsterMode; timelines: readonly T[] },
	participantId: string | undefined,
): T | undefined {
	return getHitsterModeConfig(state.mode).shared
		? state.timelines[0]
		: state.timelines.find((entry) => entry.participantId === participantId);
}

/**
 * What one participant sees of a running game: whose turn it is, whether they
 * play in it, their tokens, whether they already claimed a steal this round,
 * and the timeline they play on.
 */
export function hitsterPlayerView<
	P extends string,
	T extends { participantId?: P; cardIds: readonly string[] },
>(
	state: {
		mode: HitsterMode;
		turnOrder: readonly P[];
		activeIndex: number;
		tokens: ReadonlyArray<{ participantId: P; tokens: number }>;
		stealClaims: ReadonlyArray<{ participantId: P }>;
		timelines: readonly T[];
	},
	participantId: P | undefined,
) {
	const activeParticipantId: P | undefined = state.turnOrder[state.activeIndex];
	const isPlaying =
		participantId !== undefined && state.turnOrder.includes(participantId);
	return {
		activeParticipantId,
		isPlaying,
		isActive: isPlaying && activeParticipantId === participantId,
		myTokens:
			state.tokens.find((entry) => entry.participantId === participantId)
				?.tokens ?? 0,
		hasClaimed: state.stealClaims.some(
			(claim) => claim.participantId === participantId,
		),
		myTimeline: hitsterTimelineFor(state, participantId),
	};
}

/**
 * A drop at index i in a chronologically sorted list of years is correct when
 * the new year fits between its neighbours. Equal years are valid on either
 * side of each other.
 */
export function validateHitsterPlacement(
	timelineYears: number[],
	dropIndex: number,
	year: number,
): boolean {
	if (dropIndex < 0 || dropIndex > timelineYears.length) {
		return false;
	}
	const before = dropIndex > 0 ? timelineYears[dropIndex - 1] : undefined;
	const after =
		dropIndex < timelineYears.length ? timelineYears[dropIndex] : undefined;
	if (before !== undefined && before > year) {
		return false;
	}
	if (after !== undefined && after < year) {
		return false;
	}
	return true;
}

export function normalizeHitsterAnswer(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

export function matchesHitsterTitle(guess: string, title: string): boolean {
	const normalizedGuess = normalizeHitsterAnswer(guess);
	if (!normalizedGuess) {
		return false;
	}
	const stripped = title.replace(/\s*[([].*$/, "");
	return (
		normalizedGuess === normalizeHitsterAnswer(title) ||
		normalizedGuess === normalizeHitsterAnswer(stripped)
	);
}

export function matchesHitsterArtist(
	guess: string,
	artistNames: string[],
): boolean {
	const normalizedGuess = normalizeHitsterAnswer(guess);
	if (!normalizedGuess) {
		return false;
	}
	return (
		artistNames.some(
			(name) => normalizeHitsterAnswer(name) === normalizedGuess,
		) || normalizeHitsterAnswer(artistNames.join(" ")) === normalizedGuess
	);
}

export type HitsterAnswerFlags = {
	placementCorrect: boolean;
	artistCorrect: boolean;
	titleCorrect: boolean;
	yearCorrect: boolean;
};

type HitsterRoundOutcome = {
	cardWon: boolean;
	tokenDelta: number;
};

/** What a mode asks of an answer before it wins the card. */
function meetsHitsterCardRequirement(
	config: HitsterModeConfig,
	flags: HitsterAnswerFlags,
) {
	return (
		flags.placementCorrect &&
		(!config.needsArtistTitle || (flags.artistCorrect && flags.titleCorrect)) &&
		(!config.needsYear || flags.yearCorrect)
	);
}

export function evaluateHitsterRound(
	mode: HitsterMode,
	flags: HitsterAnswerFlags,
): HitsterRoundOutcome {
	const config = getHitsterModeConfig(mode);
	const tokenDelta =
		config.earnTokens && flags.artistCorrect && flags.titleCorrect ? 1 : 0;
	return { cardWon: meetsHitsterCardRequirement(config, flags), tokenDelta };
}

export function applyHitsterTokenDelta(
	current: number,
	delta: number,
	cap: number,
): number {
	return Math.max(0, Math.min(cap, current + delta));
}

/** Requirements for a steal claim to win the card, per mode. */
function hitsterStealRequirementMet(
	mode: HitsterMode,
	flags: HitsterAnswerFlags,
): boolean {
	const config = getHitsterModeConfig(mode);
	return config.stealsEnabled && meetsHitsterCardRequirement(config, flags);
}

/**
 * Judges claims in the order they came in. Steals only matter when the active
 * player failed to win the card: the earliest claim that meets the mode
 * requirement wins, the rest stay judged but win nothing.
 */
export function resolveHitsterSteals<Claim extends { submittedAt: number }>(
	mode: HitsterMode,
	activeWonCard: boolean,
	claims: readonly Claim[],
	flagsOf: (claim: Claim) => HitsterAnswerFlags,
) {
	let stolen = false;
	return [...claims]
		.sort((a, b) => a.submittedAt - b.submittedAt)
		.map((claim) => {
			const correct = hitsterStealRequirementMet(mode, flagsOf(claim));
			const wonCard = !activeWonCard && !stolen && correct;
			stolen ||= wonCard;
			return { claim, correct, wonCard };
		});
}

type HitsterCoopOutcome = "won" | "lost" | "ongoing";

export function getHitsterCoopOutcome({
	cardsOnTimeline,
	tokens,
	targetCards,
}: {
	cardsOnTimeline: number;
	tokens: number;
	targetCards: number;
}): HitsterCoopOutcome {
	if (cardsOnTimeline >= targetCards) {
		return "won";
	}
	if (tokens <= 0) {
		return "lost";
	}
	return "ongoing";
}
