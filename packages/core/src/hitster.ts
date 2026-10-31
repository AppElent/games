export type HitsterMode = "instant" | "original" | "pro" | "expert" | "coop";

export type HitsterPlaybackMode = "hostDevice" | "preview";

export type HitsterModeConfig = {
	label: string;
	summary: string;
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
		label: "Instant Party",
		summary: "Place the song in the right spot. First to the target wins.",
		startTokens: 0,
		tokenCap: 0,
		earnTokens: false,
		needsArtistTitle: false,
		needsYear: false,
		stealsEnabled: false,
		shared: false,
	},
	original: {
		label: "Original",
		summary:
			"Place chronologically. Name artist + title for a bonus token. Tokens fuel steals.",
		startTokens: 2,
		tokenCap: 5,
		earnTokens: true,
		needsArtistTitle: false,
		needsYear: false,
		stealsEnabled: true,
		shared: false,
	},
	pro: {
		label: "Pro",
		summary:
			"Win the card only with correct placement plus artist + title. No new tokens.",
		startTokens: 5,
		tokenCap: 5,
		earnTokens: false,
		needsArtistTitle: true,
		needsYear: false,
		stealsEnabled: true,
		shared: false,
	},
	expert: {
		label: "Expert",
		summary:
			"Placement plus exact year, artist and title required. No new tokens.",
		startTokens: 3,
		tokenCap: 5,
		earnTokens: false,
		needsArtistTitle: true,
		needsYear: true,
		stealsEnabled: true,
		shared: false,
	},
	coop: {
		label: "Cooperative",
		summary:
			"One shared timeline, 5 team tokens. Wrong placement burns a token. Reach the target before tokens run out.",
		startTokens: 5,
		tokenCap: 5,
		earnTokens: false,
		needsArtistTitle: false,
		needsYear: false,
		stealsEnabled: false,
		shared: true,
	},
};

export const HITSTER_MODES = Object.keys(MODE_CONFIGS) as HitsterMode[];

export function getHitsterModeConfig(mode: HitsterMode): HitsterModeConfig {
	return MODE_CONFIGS[mode];
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

export type HitsterRoundOutcome = {
	cardWon: boolean;
	tokenDelta: number;
};

export function evaluateHitsterRound(
	mode: HitsterMode,
	flags: HitsterAnswerFlags,
): HitsterRoundOutcome {
	const config = getHitsterModeConfig(mode);
	let cardWon = flags.placementCorrect;
	if (config.needsArtistTitle) {
		cardWon = cardWon && flags.artistCorrect && flags.titleCorrect;
	}
	if (config.needsYear) {
		cardWon = cardWon && flags.yearCorrect;
	}
	const tokenDelta =
		config.earnTokens && flags.artistCorrect && flags.titleCorrect ? 1 : 0;
	return { cardWon, tokenDelta };
}

export function applyHitsterTokenDelta(
	current: number,
	delta: number,
	cap: number,
): number {
	return Math.max(0, Math.min(cap, current + delta));
}

/** Requirements for a steal claim to win the card, per mode. */
export function hitsterStealRequirementMet(
	mode: HitsterMode,
	flags: HitsterAnswerFlags,
): boolean {
	const config = getHitsterModeConfig(mode);
	if (!config.stealsEnabled) {
		return false;
	}
	let met = flags.placementCorrect;
	if (config.needsArtistTitle) {
		met = met && flags.artistCorrect && flags.titleCorrect;
	}
	if (config.needsYear) {
		met = met && flags.yearCorrect;
	}
	return met;
}

export type HitsterStealClaimEvaluation = {
	participantId: string;
	submittedAt: number;
	flags: HitsterAnswerFlags;
};

/**
 * Steals only matter when the active player failed to win the card. The
 * earliest submitted claim that meets the mode requirement wins.
 */
export function resolveHitsterSteals(
	mode: HitsterMode,
	activeWonCard: boolean,
	claims: HitsterStealClaimEvaluation[],
): string | undefined {
	if (activeWonCard) {
		return undefined;
	}
	const sorted = [...claims].sort((a, b) => a.submittedAt - b.submittedAt);
	const winner = sorted.find((claim) =>
		hitsterStealRequirementMet(mode, claim.flags),
	);
	return winner?.participantId;
}

export type HitsterCoopOutcome = "won" | "lost" | "ongoing";

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

export function shuffleHitsterDeck<T>(
	items: readonly T[],
	random: () => number = Math.random,
): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
