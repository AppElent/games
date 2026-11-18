import { describe, expect, it } from "vitest";
import { settleHand } from "../cards/bank";
import {
	activeOptions,
	applyCardAction,
	botMove,
	type CardAction,
	type CardGameDefinition,
	type CardGameState,
	createCardGame,
	getCardGame,
	resolvedRules,
} from "../cards/engine";
import type { GinState } from "../cards/gin";
import type { RummyState } from "../cards/rummy";
import type { SheddingRules, SheddingState } from "../cards/shedding";
import {
	houseRuleLabel,
	houseRuleSwitches,
	specialCardSwitch,
	specialCards,
} from "../cards/table-view";
import type { TricksState } from "../cards/tricks";
import { GameRuleError } from "../errors";
import { en } from "../i18n/en";
import { nl } from "../i18n/nl";
import { mulberry32 } from "../random";
import {
	initialHouseRules,
	normalizeHouseRules,
	toggleHouseRule,
} from "../table-engine";

const fmt = (template: string, params: Record<string, string | number>) =>
	template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key]));
const words = { cards: en.games.cards, fmt };

function act<S extends CardGameState>(
	gameId: string,
	options: string[],
	state: S,
	seat: number,
	action: CardAction,
) {
	return applyCardAction(
		getCardGame(gameId),
		options,
		state,
		seat,
		action,
		mulberry32(3),
	) as S;
}

function dealt<S extends CardGameState>(
	gameId: string,
	options: string[],
	seats: number,
	overrides: Partial<S>,
): S {
	const state = createCardGame(
		getCardGame(gameId),
		options,
		seats,
		mulberry32(1),
	) as S;
	return { ...state, events: [], ...overrides };
}

function codeOf(run: () => unknown) {
	try {
		run();
	} catch (caught) {
		expect(caught).toBeInstanceOf(GameRuleError);
		return (caught as GameRuleError).code;
	}
	throw new Error("expected a rule error");
}

/** Mau-Mau with seat 0 to play a nine on a nine, so only its power decides the next turn. */
function nineOnTable(seats: number, options: string[]) {
	const hands = [
		["S9#0", "DK#0", "HQ#0"],
		["C8#0", "DA#0"],
		["H10#0", "CQ#0"],
	].slice(0, seats);
	return dealt<SheddingState>("maumau", options, seats, {
		hands,
		stock: ["D8#0", "C10#0", "H8#0"],
		discard: ["H9#0"],
		turn: 0,
		direction: 1,
		pendingDraw: 0,
		activeSuit: null,
	});
}

describe("a house rule that needs a number of players", () => {
	const maumau = getCardGame("maumau");

	it("counts from that many players and is ignored below it", () => {
		const two = resolvedRules(maumau, ["nineReverses"], 2)
			.rules as SheddingRules;
		const three = resolvedRules(maumau, ["nineReverses"], 3)
			.rules as SheddingRules;
		expect(two.powers["9"]).toBeUndefined();
		expect(three.powers["9"]).toEqual({ kind: "reverse" });
		expect(activeOptions(maumau, ["nineReverses", "noStacking"], 2)).toEqual([
			"noStacking",
		]);
		expect(activeOptions(maumau, ["nineReverses"], null)).toEqual([
			"nineReverses",
		]);
	});

	it("is enforced in play from the table's own size", () => {
		const options = ["nineReverses"];
		const atThree = act("maumau", options, nineOnTable(3, options), 0, {
			type: "play",
			card: "S9#0",
		});
		expect(atThree.direction).toBe(-1);
		expect(atThree.turn).toBe(2);
		const atTwo = act("maumau", options, nineOnTable(2, options), 0, {
			type: "play",
			card: "S9#0",
		});
		expect(atTwo.direction).toBe(1);
		expect(atTwo.turn).toBe(1);
	});

	it("is accepted when a room opens, before anyone knows how many will join", () => {
		expect(normalizeHouseRules(maumau.options, ["nineReverses"])).toEqual([
			"nineReverses",
		]);
	});

	it("can be on by default, and still waits for enough players", () => {
		const fixture = {
			...maumau,
			options: maumau.options.map((option) =>
				option.id === "nineReverses" ? { ...option, on: true } : option,
			),
		} as CardGameDefinition;
		const chosen = initialHouseRules(fixture.options);
		expect(chosen).toEqual(["nineReverses"]);
		const nine = specialCards(words, fixture).find((card) => card.key === "9");
		if (!nine) throw new Error("Mau-Mau offers the nine");
		expect(specialCardSwitch(nine, chosen, 2)).toEqual({
			on: false,
			disabled: true,
		});
		expect(specialCardSwitch(nine, chosen, 4)).toEqual({
			on: true,
			disabled: false,
		});
		expect(
			(resolvedRules(fixture, chosen, 4).rules as SheddingRules).powers["9"],
		).toBeDefined();
		expect(
			(resolvedRules(fixture, chosen, 2).rules as SheddingRules).powers["9"],
		).toBeUndefined();
	});

	it("shows its player count on the setup screen and in the lobby", () => {
		const nine = specialCards(words, maumau).find((card) => card.key === "9");
		expect(nine).toMatchObject({
			option: "nineReverses",
			adds: true,
			minPlayers: 3,
			effect: "Play changes direction. Counts from 3 players.",
		});
		expect(specialCardSwitch(nine as never, [], null)).toEqual({
			on: false,
			disabled: false,
		});
		expect(houseRuleLabel(words, maumau, "nineReverses", 2)).toBe(
			"9 reverses (from 3 players)",
		);
		expect(houseRuleLabel(words, maumau, "nineReverses", 3)).toBe("9 reverses");
		expect(
			houseRuleLabel({ cards: nl.games.cards, fmt }, maumau, "nineReverses", 2),
		).toBe("9 keert om (vanaf 3 spelers)");
	});
});

describe("special-card switches", () => {
	it("Mau-Mau switches each of its cards like Pesten, plus the nine it can add", () => {
		const list = specialCards(words, getCardGame("maumau"));
		expect(list.map((card) => [card.key, card.option, card.adds])).toEqual([
			["7", "plain7", false],
			["8", "plain8", false],
			["J", "plainJ", false],
			["9", "nineReverses", true],
		]);
		const seven = list[0];
		expect(specialCardSwitch(seven, [], 2).on).toBe(true);
		expect(specialCardSwitch(seven, ["plain7"], 2).on).toBe(false);
	});

	it("keeps added and plain cards out of the general house rules", () => {
		const ids = houseRuleSwitches(words, getCardGame("maumau"), 2).map(
			(rule) => rule.id,
		);
		expect(ids).toEqual([
			"noStacking",
			"noLastCard",
			"mustPlay",
			"noPlayDrawn",
		]);
	});

	it("has text for every switch of every card game in both languages", () => {
		for (const id of [
			"pesten",
			"maumau",
			"jokeren",
			"eenentwintigen",
			"hartenjagen",
			"toepen",
			"klaverjassen",
			"boerenbridge",
			"gin-rummy",
		]) {
			const game = getCardGame(id);
			for (const cards of [en.games.cards, nl.games.cards]) {
				const text = cards.games[game.id].options as Record<
					string,
					{ label: string; hint: string } | undefined
				>;
				for (const option of game.options) {
					expect(text[option.id]?.label, `${id} ${option.id}`).toBeTruthy();
					expect(text[option.id]?.hint, `${id} ${option.id}`).toBeTruthy();
				}
			}
		}
	});
});

describe("shedding switches", () => {
	/** Seat 0 holds a four of spades that fits the five on the pile. */
	const fits = (gameId: string, options: string[]) =>
		dealt<SheddingState>(gameId, options, 3, {
			hands: [
				["S10#0", "HQ#0"],
				["DK#0", "C8#0"],
				["H8#0", "C10#0"],
			],
			stock: ["SA#0", "C9#0", "DQ#0"],
			discard: ["S9#0"],
			turn: 0,
			pendingDraw: 0,
			activeSuit: null,
		});

	it.each(["pesten", "maumau"])(
		"%s: play if you can refuses a draw while a card fits",
		(gameId) => {
			expect(
				act(gameId, [], fits(gameId, []), 0, { type: "draw" }).hands[0],
			).toHaveLength(3);
			expect(
				codeOf(() =>
					act(gameId, ["mustPlay"], fits(gameId, ["mustPlay"]), 0, {
						type: "draw",
					}),
				),
			).toBe("cardsMustPlay");
		},
	);

	it.each(["pesten", "maumau"])(
		"%s: a drawn card waits a turn under the house rule",
		(gameId) => {
			const stuck = (options: string[]) =>
				dealt<SheddingState>(gameId, options, 3, {
					hands: [
						["HQ#0", "DK#0"],
						["DA#0", "C8#0"],
						["H8#0", "C10#0"],
					],
					// The top of the stock fits the pile.
					stock: ["C9#0", "DQ#0", "SK#0"],
					discard: ["S9#0"],
					turn: 0,
					pendingDraw: 0,
					activeSuit: null,
				});
			const drew = act(gameId, [], stuck([]), 0, { type: "draw" });
			expect(drew.drawnCard).not.toBeNull();
			expect(drew.turn).toBe(0);
			const waits = act(gameId, ["noPlayDrawn"], stuck(["noPlayDrawn"]), 0, {
				type: "draw",
			});
			expect(waits.drawnCard).toBeNull();
			expect(waits.turn).toBe(1);
		},
	);
});

describe("jokeren: open with any meld", () => {
	const state = (options: string[]) =>
		dealt<RummyState>("jokeren", options, 2, {
			hands: [["S2#0", "S3#0", "S4#0", "C5#0", "D9#0"], ["D2#0"]],
			phase: "play",
			turn: 0,
		});
	const lay: CardAction = {
		type: "layDown",
		melds: [["S2#0", "S3#0", "S4#0"]],
	};

	it("lets a nine-point run open the table", () => {
		expect(codeOf(() => act("jokeren", [], state([]), 0, lay))).toBe(
			"cardsOpeningTooLow",
		);
		const opened = act(
			"jokeren",
			["openAnyMeld"],
			state(["openAnyMeld"]),
			0,
			lay,
		);
		expect(opened.opened[0]).toBe(true);
	});

	it("excludes opening at 40", () => {
		const game = getCardGame("jokeren");
		expect(toggleHouseRule(game.options, ["openAt40"], "openAnyMeld")).toEqual([
			"openAnyMeld",
		]);
		expect(
			codeOf(() =>
				normalizeHouseRules(game.options, ["openAt40", "openAnyMeld"]),
			),
		).toBe("cardsOptionsClash");
	});
});

describe("eenentwintigen: 21 in two pays double", () => {
	it("doubles a natural's points", () => {
		const game = getCardGame("eenentwintigen");
		const pays = (options: string[]) =>
			resolvedRules(game, options, 2).rules as { naturalPays: number };
		const natural = ["HA#0", "SK#0"];
		const bank = ["D10#0", "C9#0"];
		expect(settleHand(pays([]), natural, bank, 2)).toBe(3);
		expect(settleHand(pays(["naturalPaysDouble"]), natural, bank, 2)).toBe(4);
	});
});

describe("hartenjagen switches", () => {
	const midDeal = (options: string[], over: Partial<TricksState>) =>
		dealt<TricksState>("hartenjagen", options, 3, {
			phase: "playing",
			passDirection: "keep",
			turn: 0,
			trick: [],
			...over,
		});

	it("hearts may be led before they are broken", () => {
		const hands = [
			["H5#0", "D3#0"],
			["H6#0", "D9#0"],
			["H7#0", "D8#0"],
		];
		const state = (options: string[]) =>
			midDeal(options, { hands, tricksTaken: [1, 0, 0], broken: false });
		expect(
			codeOf(() =>
				act("hartenjagen", [], state([]), 0, { type: "play", card: "H5#0" }),
			),
		).toBe("cardsLeadNotBroken");
		const led = act(
			"hartenjagen",
			["heartsAnyTime"],
			state(["heartsAnyTime"]),
			0,
			{
				type: "play",
				card: "H5#0",
			},
		);
		expect(led.trick).toEqual([{ seat: 0, card: "H5#0" }]);
	});

	it("hearts any time excludes the queen breaking hearts", () => {
		const game = getCardGame("hartenjagen");
		expect(
			toggleHouseRule(game.options, ["queenBreaksHearts"], "heartsAnyTime"),
		).toEqual(["heartsAnyTime"]);
	});

	it("taking every point card without the moon rule costs the taker 26", () => {
		const hearts = [
			"2",
			"3",
			"4",
			"5",
			"6",
			"7",
			"8",
			"9",
			"10",
			"J",
			"Q",
			"K",
			"A",
		].map((rank) => `H${rank}#0`);
		const scored = (options: string[]) => {
			let state = midDeal(options, {
				hands: [["D5#9"], ["D6#9"], ["D7#9"]],
				taken: [[], [...hearts, "SQ#0"], []],
				scores: [],
				tricksTaken: [1, 1, 0],
				broken: true,
			});
			for (let seat = 0; seat < 3; seat += 1) {
				state = act("hartenjagen", options, state, seat, {
					type: "play",
					card: `D${seat + 5}#9`,
				});
			}
			return state;
		};
		expect(scored([]).scores.at(-1)).toEqual([26, 0, 26]);
		expect(scored(["noMoon"]).scores.at(-1)).toEqual([0, 26, 0]);
		expect(scored(["noMoon"]).moon).toBeNull();
	});
});

describe("klaverjassen: no roem", () => {
	it("gives no roem for a run, and no pit bonus", () => {
		const state = (options: string[]) =>
			dealt<TricksState>("klaverjassen", options, 4, {
				phase: "playing",
				trump: "H",
				maker: 0,
				hands: [["C7#0"], ["C8#0"], ["C9#0"], ["S7#0", "D7#0"]],
				trick: [
					{ seat: 0, card: "S9#0" },
					{ seat: 1, card: "S10#0" },
					{ seat: 2, card: "SJ#0" },
				],
				turn: 3,
			});
		const play: CardAction = { type: "play", card: "S7#0" };
		expect(act("klaverjassen", [], state([]), 3, play).roem).toEqual([
			0, 20, 0, 0,
		]);
		const plain = act("klaverjassen", ["noRoem"], state(["noRoem"]), 3, play);
		expect(plain.roem ?? [0, 0, 0, 0]).toEqual([0, 0, 0, 0]);
		expect(plain.lastTrick?.roem).toBeUndefined();
		expect(
			resolvedRules(getCardGame("klaverjassen"), ["noRoem"], 4).rules,
		).toMatchObject({ roem: false, pitBonus: 0 });
	});
});

describe("boerenbridge: no trump", () => {
	it("turns no card up, so no suit is trump", () => {
		const game = getCardGame("boerenbridge");
		const withTrump = createCardGame(game, [], 5, mulberry32(4)) as TricksState;
		expect(withTrump.trump).not.toBeNull();
		const without = createCardGame(
			game,
			["noTrump"],
			5,
			mulberry32(4),
		) as TricksState;
		expect(without.trump).toBeNull();
		expect(without.turnedUp).toBeNull();
	});
});

describe("gin rummy: straight gin", () => {
	const ids = (faces: string) => faces.split(" ").map((face) => `${face}#0`);
	const state = (options: string[], hand: string) =>
		dealt<GinState>("gin-rummy", options, 2, {
			hands: [ids(hand), ids("S5 H8 DQ C3 C4 HK SK DK C7 H2")],
			discard: ids("C5"),
			turn: 0,
			phase: "play",
		});
	// Three runs and a two of clubs: two points of deadwood after the king goes.
	const twoDeadwood = "S2 S3 S4 H5 H6 H7 D8 D9 D10 C2 CK";
	const knock: CardAction = { type: "knock", card: "CK#0" };

	it("refuses a knock with deadwood, and still allows gin", () => {
		expect(act("gin-rummy", [], state([], twoDeadwood), 0, knock).phase).toBe(
			"layoff",
		);
		expect(
			codeOf(() =>
				act(
					"gin-rummy",
					["straightGin"],
					state(["straightGin"], twoDeadwood),
					0,
					knock,
				),
			),
		).toBe("cardsKnockTooHigh");
		const gin = act(
			"gin-rummy",
			["straightGin"],
			state(["straightGin"], "S2 S3 S4 H5 H6 H7 D8 D9 D10 DJ CK"),
			0,
			knock,
		);
		expect(gin.knock).toEqual({ seat: 0, gin: true });
	});

	it("keeps the computer from knocking with deadwood", () => {
		const game = getCardGame("gin-rummy");
		const move = (options: string[]) =>
			botMove(game, options, state(options, twoDeadwood), [0], mulberry32(1))
				?.action.type;
		expect(move([])).toBe("knock");
		expect(move(["straightGin"])).toBe("discard");
	});
});
