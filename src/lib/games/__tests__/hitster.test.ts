import { describe, expect, it } from "vitest";
import {
	applyHitsterTokenDelta,
	evaluateHitsterRound,
	getHitsterCoopOutcome,
	getHitsterModeConfig,
	HITSTER_MODES,
	hitsterStealRequirementMet,
	matchesHitsterArtist,
	matchesHitsterTitle,
	normalizeHitsterAnswer,
	resolveHitsterSteals,
	shuffleHitsterDeck,
	validateHitsterPlacement,
} from "../hitster";
import {
	getHitsterCard,
	getPlayableHitsterCards,
	listHitsterPacks,
} from "../hitsterPacks";

const allCorrect = {
	placementCorrect: true,
	artistCorrect: true,
	titleCorrect: true,
	yearCorrect: true,
};

describe("placement validation", () => {
	const years = [1965, 1978, 1991, 2004];

	it("accepts a drop between the right neighbours", () => {
		expect(validateHitsterPlacement(years, 0, 1956)).toBe(true);
		expect(validateHitsterPlacement(years, 2, 1983)).toBe(true);
		expect(validateHitsterPlacement(years, 4, 2019)).toBe(true);
	});

	it("rejects a drop in the wrong slot", () => {
		expect(validateHitsterPlacement(years, 0, 1970)).toBe(false);
		expect(validateHitsterPlacement(years, 4, 1960)).toBe(false);
		expect(validateHitsterPlacement(years, 1, 2000)).toBe(false);
	});

	it("rejects out-of-range drop indexes", () => {
		expect(validateHitsterPlacement(years, -1, 1950)).toBe(false);
		expect(validateHitsterPlacement(years, 5, 2020)).toBe(false);
	});

	it("accepts same-year placements on either side", () => {
		expect(validateHitsterPlacement([1991], 0, 1991)).toBe(true);
		expect(validateHitsterPlacement([1991], 1, 1991)).toBe(true);
		expect(validateHitsterPlacement([1983, 1983], 1, 1983)).toBe(true);
	});

	it("accepts any drop on an empty timeline", () => {
		expect(validateHitsterPlacement([], 0, 1999)).toBe(true);
	});
});

describe("answer matching", () => {
	it("normalizes case, punctuation and diacritics", () => {
		expect(normalizeHitsterAnswer("Beyoncé!")).toBe("beyonce");
		expect(matchesHitsterTitle("stayin alive", "Stayin' Alive")).toBe(true);
		expect(matchesHitsterArtist("celine dion", ["Céline Dion"])).toBe(true);
	});

	it("accepts titles without the parenthetical part", () => {
		expect(
			matchesHitsterTitle("sweet dreams", "Sweet Dreams (Are Made of This)"),
		).toBe(true);
	});

	it("rejects wrong or empty answers", () => {
		expect(matchesHitsterTitle("", "Vogue")).toBe(false);
		expect(matchesHitsterTitle("Like a Prayer", "Vogue")).toBe(false);
		expect(matchesHitsterArtist("Prince", ["Madonna"])).toBe(false);
	});
});

describe("mode-specific scoring", () => {
	it("instant party only needs placement", () => {
		expect(
			evaluateHitsterRound("instant", {
				...allCorrect,
				artistCorrect: false,
				titleCorrect: false,
				yearCorrect: false,
			}),
		).toEqual({ cardWon: true, tokenDelta: 0 });
	});

	it("original wins on placement and earns a bonus token for artist+title", () => {
		expect(evaluateHitsterRound("original", allCorrect)).toEqual({
			cardWon: true,
			tokenDelta: 1,
		});
		expect(
			evaluateHitsterRound("original", {
				...allCorrect,
				placementCorrect: false,
			}),
		).toEqual({ cardWon: false, tokenDelta: 1 });
		expect(
			evaluateHitsterRound("original", { ...allCorrect, titleCorrect: false }),
		).toEqual({ cardWon: true, tokenDelta: 0 });
	});

	it("pro requires placement plus artist and title, and earns nothing", () => {
		expect(evaluateHitsterRound("pro", allCorrect)).toEqual({
			cardWon: true,
			tokenDelta: 0,
		});
		expect(
			evaluateHitsterRound("pro", { ...allCorrect, artistCorrect: false }),
		).toEqual({ cardWon: false, tokenDelta: 0 });
	});

	it("expert additionally requires the exact year", () => {
		expect(evaluateHitsterRound("expert", allCorrect)).toEqual({
			cardWon: true,
			tokenDelta: 0,
		});
		expect(
			evaluateHitsterRound("expert", { ...allCorrect, yearCorrect: false }),
		).toEqual({ cardWon: false, tokenDelta: 0 });
	});

	it("configures start tokens per mode", () => {
		expect(getHitsterModeConfig("original").startTokens).toBe(2);
		expect(getHitsterModeConfig("pro").startTokens).toBe(5);
		expect(getHitsterModeConfig("expert").startTokens).toBe(3);
		expect(getHitsterModeConfig("coop").startTokens).toBe(5);
	});
});

describe("token cap", () => {
	it("clamps to the cap and never below zero", () => {
		expect(applyHitsterTokenDelta(5, 1, 5)).toBe(5);
		expect(applyHitsterTokenDelta(4, 1, 5)).toBe(5);
		expect(applyHitsterTokenDelta(0, -1, 5)).toBe(0);
		expect(applyHitsterTokenDelta(2, -1, 5)).toBe(1);
	});
});

describe("steal claims", () => {
	it("only apply when the active player missed", () => {
		expect(
			resolveHitsterSteals("original", true, [
				{ participantId: "p2", submittedAt: 1, flags: allCorrect },
			]),
		).toBeUndefined();
	});

	it("earliest qualifying claim wins", () => {
		expect(
			resolveHitsterSteals("original", false, [
				{
					participantId: "late",
					submittedAt: 20,
					flags: allCorrect,
				},
				{
					participantId: "wrong",
					submittedAt: 5,
					flags: { ...allCorrect, placementCorrect: false },
				},
				{ participantId: "early", submittedAt: 10, flags: allCorrect },
			]),
		).toBe("early");
	});

	it("pro steals require artist and title, expert also the year", () => {
		const placementOnly = {
			...allCorrect,
			artistCorrect: false,
			titleCorrect: false,
			yearCorrect: false,
		};
		expect(hitsterStealRequirementMet("original", placementOnly)).toBe(true);
		expect(hitsterStealRequirementMet("pro", placementOnly)).toBe(false);
		expect(hitsterStealRequirementMet("pro", allCorrect)).toBe(true);
		expect(
			hitsterStealRequirementMet("expert", {
				...allCorrect,
				yearCorrect: false,
			}),
		).toBe(false);
		expect(hitsterStealRequirementMet("coop", allCorrect)).toBe(false);
	});
});

describe("cooperative outcome", () => {
	it("wins at the target card count", () => {
		expect(
			getHitsterCoopOutcome({
				cardsOnTimeline: 10,
				tokens: 2,
				targetCards: 10,
			}),
		).toBe("won");
	});

	it("loses when tokens run out before the target", () => {
		expect(
			getHitsterCoopOutcome({ cardsOnTimeline: 6, tokens: 0, targetCards: 10 }),
		).toBe("lost");
	});

	it("continues otherwise", () => {
		expect(
			getHitsterCoopOutcome({ cardsOnTimeline: 6, tokens: 3, targetCards: 10 }),
		).toBe("ongoing");
	});
});

describe("packs", () => {
	it("ships at least 3 packs with 40+ playable cards each", () => {
		const packs = listHitsterPacks();
		expect(packs.length).toBeGreaterThanOrEqual(3);
		for (const pack of packs) {
			expect(pack.cards.length).toBeGreaterThanOrEqual(40);
			expect(getPlayableHitsterCards(pack.id, "hostDevice").length).toBe(
				pack.cards.length,
			);
		}
	});

	it("has unique card ids and valid years", () => {
		const seen = new Set<string>();
		for (const pack of listHitsterPacks()) {
			for (const card of pack.cards) {
				expect(seen.has(card.id)).toBe(false);
				seen.add(card.id);
				expect(card.releaseYear).toBeGreaterThanOrEqual(1950);
				expect(card.releaseYear).toBeLessThanOrEqual(2026);
			}
		}
	});

	it("limits nineties pack to 1990-1999", () => {
		const pack = listHitsterPacks().find((entry) => entry.id === "nineties");
		expect(pack).toBeDefined();
		for (const card of pack?.cards ?? []) {
			expect(card.releaseYear).toBeGreaterThanOrEqual(1990);
			expect(card.releaseYear).toBeLessThanOrEqual(1999);
		}
	});

	it("excludes tracks without preview audio in preview mode", () => {
		expect(getPlayableHitsterCards("normal", "preview")).toEqual([]);
	});

	it("looks up cards by id", () => {
		const card = getHitsterCard("rock", "rock-1");
		expect(card?.title).toBe("Smells Like Teen Spirit");
	});
});

describe("deck shuffle", () => {
	it("keeps all items and honours the injected rng", () => {
		const deck = shuffleHitsterDeck([1, 2, 3, 4], () => 0);
		expect([...deck].sort()).toEqual([1, 2, 3, 4]);
		expect(HITSTER_MODES).toContain("coop");
	});
});
