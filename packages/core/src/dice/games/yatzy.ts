import type { DiceGameDefinition } from "../engine";
import type { ScoresheetRules, SheetEntry } from "../scoresheet";

const UPPER = [
	{ id: "ones", section: "upper", rule: { kind: "face", face: 1 } },
	{ id: "twos", section: "upper", rule: { kind: "face", face: 2 } },
	{ id: "threes", section: "upper", rule: { kind: "face", face: 3 } },
	{ id: "fours", section: "upper", rule: { kind: "face", face: 4 } },
	{ id: "fives", section: "upper", rule: { kind: "face", face: 5 } },
	{ id: "sixes", section: "upper", rule: { kind: "face", face: 6 } },
] as const satisfies readonly SheetEntry[];

/** The Scandinavian sheet: fifteen boxes, straights and full house score their dice. */
const SCANDINAVIAN = [
	...UPPER,
	{ id: "onePair", section: "lower", rule: { kind: "pairs", pairs: 1 } },
	{ id: "twoPairs", section: "lower", rule: { kind: "pairs", pairs: 2 } },
	{
		id: "threeKind",
		section: "lower",
		rule: { kind: "kind", count: 3, score: "matching" },
	},
	{
		id: "fourKind",
		section: "lower",
		rule: { kind: "kind", count: 4, score: "matching" },
	},
	{
		id: "smallStraight",
		section: "lower",
		rule: { kind: "straight", length: 5, from: 1, points: "sum" },
	},
	{
		id: "largeStraight",
		section: "lower",
		rule: { kind: "straight", length: 5, from: 2, points: "sum" },
	},
	{
		id: "fullHouse",
		section: "lower",
		rule: { kind: "fullHouse", points: "sum" },
	},
	{ id: "chance", section: "lower", rule: { kind: "chance" } },
	{ id: "yatzy", section: "lower", rule: { kind: "allSame", points: 50 } },
] as const satisfies readonly SheetEntry[];

/** The American sheet: thirteen boxes with fixed points and bonus Yahtzees. */
const YAHTZEE = {
	sheet: [
		...UPPER,
		{
			id: "threeKind",
			section: "lower",
			rule: { kind: "kind", count: 3, score: "all" },
		},
		{
			id: "fourKind",
			section: "lower",
			rule: { kind: "kind", count: 4, score: "all" },
		},
		{
			id: "fullHouse",
			section: "lower",
			rule: { kind: "fullHouse", points: 25 },
		},
		{
			id: "smallStraight",
			section: "lower",
			rule: { kind: "straight", length: 4, points: 30 },
		},
		{
			id: "largeStraight",
			section: "lower",
			rule: { kind: "straight", length: 5, points: 40 },
		},
		{ id: "yatzy", section: "lower", rule: { kind: "allSame", points: 50 } },
		{ id: "chance", section: "lower", rule: { kind: "chance" } },
	],
	upperBonus: { threshold: 63, points: 35 },
	extraAllSame: { bonus: 100 },
} as const satisfies Partial<ScoresheetRules>;

/**
 * Yatzy as it is played in Scandinavia and the Netherlands. Every rule below is
 * data; the score-sheet family has no Yatzy-specific code. Text lives in the
 * message catalog under `games.dice.games.yatzy`.
 */
export const yatzy = {
	id: "yatzy",
	family: "scoresheet",
	felt: "bottle",
	showcase: [6, 6, 6, 6, 6],
	players: { min: 1, max: 6 },
	rules: {
		dice: 5,
		rollsPerTurn: 3,
		sheet: SCANDINAVIAN,
		upperBonus: { threshold: 63, points: 50 },
		extraAllSame: null,
	},
	options: [{ id: "yahtzeeSheet", patch: YAHTZEE }],
} as const satisfies DiceGameDefinition;
