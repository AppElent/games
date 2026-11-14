/**
 * What every client derives the same way from a table: names, sentences, the
 * order of seats, which moves a selection allows, which cards just arrived, and
 * which cards cross the table. No drawing and no framework.
 */
import type { Messages } from "../i18n/en";
import {
	type CardId,
	cardFace,
	parseCard,
	RANKS,
	SUITS,
	type Suit,
} from "./deck";
import {
	type CardGameDefinition,
	plainCardOption,
	SEAT_SILENT_AFTER_MS,
} from "./engine";
import type { CardEvent } from "./events";
import {
	arrangeHand,
	bestDiscard,
	fitLayoff,
	type GinHandResult,
	type GinRules,
	type GinView,
} from "./gin";
import {
	buildMeld,
	fitOnMeld,
	type Meld,
	type MeldRules,
	meldPoints,
	runFaceAt,
	swapJoker,
} from "./melds";
import type { RummyRules, RummyView } from "./rummy";
import type { CardPower, SheddingRules, SheddingView } from "./shedding";
import type { TricksRules, TricksView } from "./tricks";

export type CardMessages = Messages["games"]["cards"];

/** The client's own text helpers, so this module stays free of locale runtime. */
export type CardWords = {
	cards: CardMessages;
	fmt: (template: string, params: Record<string, string | number>) => string;
	countOf: (count: number, forms: { one: string; other: string }) => string;
};

type TableSeat = {
	botIndex: number | null;
	name: string | null;
	autopilot: boolean;
	lastSeen: number | null;
};
type TableSeats = { seats: readonly TableSeat[]; you: number | null };

export function seatName(
	cards: CardMessages,
	table: TableSeats,
	seat: number,
): string {
	if (seat === table.you) {
		return cards.table.you;
	}
	const entry = table.seats[seat];
	if (entry?.botIndex !== null && entry?.botIndex !== undefined) {
		return (cards.bots as Record<string, string>)[`bot${entry.botIndex}`];
	}
	return entry?.name ?? cards.setup.youFallback;
}

/** What a special card does, in words, under these rules. */
export function powerEffect(
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
	rules: Pick<SheddingRules, "twoPlayerReverseAgain">,
	power: CardPower,
) {
	const effects = cards.rules.effects;
	switch (power.kind) {
		case "draw":
			return fmt(power.wild ? effects.drawWild : effects.draw, {
				count: power.amount,
			});
		case "reverse":
			return rules.twoPlayerReverseAgain
				? effects.reverseDuel
				: effects.reverse;
		default:
			return effects[power.kind];
	}
}

export type SpecialCard = {
	/** The key in `rules.powers`: a rank, or "joker". */
	key: string;
	/** A card to draw as its picture. */
	sample: CardId;
	name: string;
	effect: string;
	/** The house rule that turns it into a plain card, if the game offers one. */
	plainOption: string | null;
};

/**
 * Every special card a game deals, before house rules, so a setup screen can
 * list them all and offer to switch each one off.
 */
export function specialCards(
	words: Pick<CardWords, "cards" | "fmt">,
	game: CardGameDefinition,
): SpecialCard[] {
	if (game.family !== "shedding") {
		return [];
	}
	const rules = game.rules as SheddingRules;
	const names = words.cards.games[game.id as keyof CardMessages["games"]]
		.powers as Record<string, string>;
	return Object.entries(rules.powers).map(([key, power]) => ({
		key,
		sample: key === "joker" ? "JK#0" : `S${key}#0`,
		name: names[key] ?? key,
		effect: powerEffect(words, rules, power as CardPower),
		plainOption: plainCardOption(game, key)?.id ?? null,
	}));
}

/** The other seats in the order play reaches them, so the table reads clockwise. */
export function opponentOrder(table: TableSeats): number[] {
	const count = table.seats.length;
	if (table.you === null) {
		return table.seats.map((_, index) => index);
	}
	const you = table.you;
	return Array.from(
		{ length: count - 1 },
		(_, step) => (you + step + 1) % count,
	);
}

/** Only a person can go quiet, and an autopilot seat keeps playing regardless. */
export function seatIsSilent(seat: TableSeat, now: number) {
	return (
		seat.botIndex === null &&
		!seat.autopilot &&
		seat.lastSeen !== null &&
		now - seat.lastSeen > SEAT_SILENT_AFTER_MS
	);
}

export function cardName(cards: CardMessages, id: CardId) {
	const card = parseCard(id);
	return card.joker
		? cards.joker
		: cards.cardName
				.replace("{rank}", cards.ranks[card.rank])
				.replace("{suit}", cards.suits[card.suit]);
}

/** Each card of a meld as a sentence, including what a joker in a run stands for. */
export function meldCardNames(cards: CardMessages, meld: Meld) {
	return meld.cards.map((card, index) => {
		if (!parseCard(card).joker || meld.kind !== "run") {
			return cardName(cards, card);
		}
		const face = runFaceAt(meld, index);
		return cards.rummy.jokerAs.replace(
			"{card}",
			cards.cardName
				.replace("{rank}", cards.ranks[face.rank])
				.replace("{suit}", cards.suits[face.suit]),
		);
	});
}

const rankOrder = (id: CardId) => {
	const card = parseCard(id);
	if (card.joker) {
		return 99;
	}
	return card.rank === "A" ? 14 : RANKS.indexOf(card.rank) + 1;
};

const suitOrder = (id: CardId) => {
	const card = parseCard(id);
	return card.joker ? 99 : SUITS.indexOf(card.suit);
};

/** Jokers go last; aces high, because that is how hands get read. */
export function sortCards(hand: readonly CardId[], by: "suit" | "rank") {
	return [...hand].sort((a, b) =>
		by === "suit"
			? suitOrder(a) - suitOrder(b) || rankOrder(a) - rankOrder(b)
			: rankOrder(a) - rankOrder(b) || suitOrder(a) - suitOrder(b),
	);
}

/** A stable lean for a card on the pile, so it doesn't jiggle on every render. */
export function cardTilt(id: CardId) {
	let hash = 0;
	for (const char of id) {
		hash = (hash * 31 + char.charCodeAt(0)) % 997;
	}
	return (hash % 15) - 7;
}

/** How a gin hand ended, for the ticker and the hand result. */
export function ginResultText(
	outcome: Pick<GinHandResult, "winner" | "kind" | "points">,
	{ cards, fmt, countOf }: CardWords,
	table: TableSeats,
): string {
	const g = cards.gin;
	if (outcome.kind === "void" || outcome.winner === null) {
		return g.resultVoid;
	}
	const forms =
		outcome.winner === table.you
			? {
					gin: g.resultYouGin,
					knock: g.resultYouKnock,
					undercut: g.resultYouUndercut,
				}
			: { gin: g.resultGin, knock: g.resultKnock, undercut: g.resultUndercut };
	return fmt(countOf(outcome.points, forms[outcome.kind]), {
		name: seatName(cards, table, outcome.winner),
	});
}

/** One sentence for the ticker; screen readers hear it through a live region. */
export function describeEvent(
	event: CardEvent,
	words: CardWords,
	table: TableSeats,
): string {
	const { cards, fmt, countOf } = words;
	const e = cards.events;
	const name = (seat: number) => seatName(cards, table, seat);
	const mine = (seat: number) => seat === table.you;
	switch (event.type) {
		case "deal":
			return event.round > 1
				? fmt(e.dealRound, { round: event.round })
				: e.deal;
		case "play": {
			const card = cardName(cards, event.card);
			if (event.suit) {
				const suit = cards.suits[event.suit];
				return mine(event.seat)
					? fmt(e.youChooseSuit, { card, suit })
					: fmt(e.chooseSuit, { card, suit, name: name(event.seat) });
			}
			return mine(event.seat)
				? fmt(e.youPlay, { card })
				: fmt(e.play, { card, name: name(event.seat) });
		}
		case "draw":
			if (event.source === "discard") {
				return mine(event.seat)
					? e.youTakeDiscard
					: fmt(e.takeDiscard, { name: name(event.seat) });
			}
			return mine(event.seat)
				? e.youDraw
				: fmt(e.draw, { name: name(event.seat) });
		case "penalty":
			return mine(event.seat)
				? countOf(event.count, e.youPenalty)
				: fmt(countOf(event.count, e.penalty), { name: name(event.seat) });
		case "skip":
			return mine(event.seat)
				? e.youSkip
				: fmt(e.skip, { name: name(event.seat) });
		case "reverse":
			return e.reverse;
		case "again":
			return mine(event.seat)
				? e.youAgain
				: fmt(e.again, { name: name(event.seat) });
		case "pass":
			return mine(event.seat)
				? e.youPass
				: fmt(e.pass, { name: name(event.seat) });
		case "reshuffle":
			return e.reshuffle;
		case "lastCard":
			return mine(event.seat)
				? e.youLastCard
				: fmt(e.lastCard, { name: name(event.seat) });
		case "caught":
			return fmt(
				countOf(
					event.count,
					mine(event.seat)
						? e.caughtYou
						: mine(event.by)
							? e.youCaught
							: e.caught,
				),
				{ by: name(event.by), name: name(event.seat) },
			);
		case "finishPenalty":
			return mine(event.seat)
				? countOf(event.count, e.youFinishPenalty)
				: fmt(countOf(event.count, e.finishPenalty), {
						name: name(event.seat),
					});
		case "meld":
			if (event.opened) {
				return mine(event.seat)
					? e.youMeldOpened
					: fmt(e.meldOpened, { name: name(event.seat) });
			}
			return mine(event.seat)
				? e.youMeld
				: fmt(e.meld, { name: name(event.seat) });
		case "layoff":
			return mine(event.seat)
				? e.youLayoff
				: fmt(e.layoff, { name: name(event.seat) });
		case "swap":
			return mine(event.seat)
				? e.youSwap
				: fmt(e.swap, { name: name(event.seat) });
		case "discard": {
			const card = cardName(cards, event.card);
			return mine(event.seat)
				? fmt(e.youDiscard, { card })
				: fmt(e.discard, { card, name: name(event.seat) });
		}
		case "knock":
			if (event.gin) {
				return mine(event.seat)
					? e.youGin
					: fmt(e.gin, { name: name(event.seat) });
			}
			return mine(event.seat)
				? e.youKnock
				: fmt(e.knock, { name: name(event.seat) });
		case "handEnd":
			return ginResultText(event, words, table);
		case "roundEnd":
			return event.winner === null
				? e.roundEndNobody
				: mine(event.winner)
					? e.youRoundEnd
					: fmt(e.roundEnd, { name: name(event.winner) });
		case "passReady":
			return mine(event.seat)
				? e.youPassReady
				: fmt(e.passReady, { name: name(event.seat) });
		case "exchange":
			return e.exchange;
		case "trickWon":
			if (event.points === 0) {
				return mine(event.seat)
					? e.youTrickWonClean
					: fmt(e.trickWonClean, { name: name(event.seat) });
			}
			return mine(event.seat)
				? countOf(event.points, e.youTrickWon)
				: fmt(countOf(event.points, e.trickWon), { name: name(event.seat) });
		case "broken":
			return fmt(e.broken, { suit: cards.suits[event.suit] });
		case "moon":
			return mine(event.seat)
				? e.youMoon
				: fmt(e.moon, { name: name(event.seat) });
		case "win":
			if (event.seats.length > 1) {
				return fmt(e.winTie, { name: event.seats.map(name).join(" & ") });
			}
			return mine(event.seats[0])
				? e.youWin
				: fmt(e.win, { name: name(event.seats[0]) });
	}
}

/** Means little alone: "Anna misses a turn" doesn't say who played what. */
const FOLLOWS_A_PLAY: ReadonlySet<CardEvent["type"]> = new Set([
	"skip",
	"reverse",
	"again",
	"broken",
	"trickWon",
]);

/** The latest thing that happened, as the table's one line of narration. */
export function latestEventText(
	events: readonly CardEvent[],
	words: CardWords,
	table: TableSeats,
) {
	const latest = events.at(-1);
	if (!latest) {
		return "";
	}
	const before = FOLLOWS_A_PLAY.has(latest.type)
		? events.slice(-3, -1).find((event) => event.type === "play")
		: null;
	return [before, latest]
		.filter((event) => event != null)
		.map((event) => describeEvent(event, words, table))
		.join(" ");
}

/** What to do now on a shedding turn; null when it isn't this player's turn. */
export function sheddingHint(
	view: SheddingView,
	mine: boolean,
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
) {
	if (!mine) {
		return null;
	}
	if (view.pendingDraw > 0) {
		return fmt(
			view.legal.length > 0
				? cards.shedding.mustAnswer
				: cards.shedding.mustTake,
			{ count: view.pendingDraw },
		);
	}
	if (view.drawnCard) {
		return cards.shedding.playDrawnHint;
	}
	if (view.mustContinue) {
		return cards.shedding.mustContinue;
	}
	return view.legal.length > 0
		? cards.shedding.pickMove
		: cards.shedding.noMove;
}

/** What to do now in a trick-taking deal; null when there's nothing for this seat to do. */
export function tricksHint(
	view: TricksView,
	you: number | null,
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
	rules: Pick<TricksRules, "firstLead" | "breaking">,
) {
	const t = cards.tricks;
	if (you === null) {
		return null;
	}
	if (view.phase === "passing") {
		return view.passed
			? t.passWaiting
			: fmt(t.passHint, {
					count: view.passCount,
					direction: t.directions[view.passDirection],
				});
	}
	if (view.phase !== "playing" || view.turn !== you) {
		return null;
	}
	const led = view.trick[0]?.card;
	if (led) {
		const suit = cards.suits[parseCard(led).suit as Suit];
		const following = view.legal.some(
			(card) => parseCard(card).suit === parseCard(led).suit,
		);
		return fmt(following ? t.follow : t.void, { suit });
	}
	const opening = rules.firstLead;
	if (
		opening &&
		view.legal.length === 1 &&
		cardFace(view.legal[0]) === opening
	) {
		return fmt(t.leadFirst, { card: cardName(cards, view.legal[0]) });
	}
	const breaking = rules.breaking;
	// Only worth saying when the rule holds something back.
	if (
		breaking &&
		!view.broken &&
		view.hand.some((card) => parseCard(card).suit === breaking.suit) &&
		view.legal.every((card) => parseCard(card).suit !== breaking.suit)
	) {
		return fmt(t.leadNotBroken, { suit: cards.suits[breaking.suit] });
	}
	return t.lead;
}

/** The line under a seat: passed while cards are being chosen, else its points. */
export function tricksSeatNote(
	view: Pick<TricksView, "phase" | "passReady" | "totals" | "roundPoints">,
	seat: number,
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
) {
	if (view.phase === "passing" && view.passReady[seat]) {
		return cards.tricks.passedNote;
	}
	const round = view.roundPoints[seat];
	return fmt(cards.tricks.seatScore, {
		total: view.totals[seat],
		round: round < 0 ? `−${-round}` : `+${round}`,
	});
}

/** A face such as "SQ" as a card name, in this language. */
function faceName(cards: CardMessages, face: string) {
	return cardName(cards, `${face}#0`);
}

/** The rules sheet for a trick-taking game, written from its config. */
export function tricksRuleLines(
	{ cards, fmt, countOf }: CardWords,
	rules: TricksRules,
) {
	const r = cards.rules.tricks;
	const t = cards.tricks;
	const passing = rules.passing;
	const glyph = (rank: (typeof RANKS)[number]) =>
		(cards.rankGlyphs as Record<string, string>)[rank] ?? rank;
	const breaking = rules.breaking;
	return {
		goal: fmt(r.goal, { target: rules.target }),
		passing: passing
			? [
					fmt(r.pass, {
						count: passing.count,
						cycle: passing.cycle
							.map((direction) => t.directions[direction])
							.join(", "),
					}),
					...(passing.cycle.includes("across") ? [r.passOdd] : []),
				]
			: [r.noPass],
		turn: [
			...(rules.firstLead
				? [fmt(r.firstLead, { card: faceName(cards, rules.firstLead) })]
				: []),
			r.follow,
			r.trick,
			fmt(r.ranks, { ranks: [...rules.ranks].reverse().map(glyph).join(" ") }),
			...(breaking
				? [
						fmt(r.breaking, { suit: cards.suits[breaking.suit] }),
						...breaking.alsoBrokenBy.map((face) =>
							fmt(r.breakingAlso, { card: faceName(cards, face) }),
						),
					]
				: []),
		],
		points: [
			...Object.entries(rules.suitPoints).map(([suit, points]) =>
				fmt(countOf(points as number, r.pointSuit), {
					suit: cards.suits[suit as Suit],
				}),
			),
			...Object.entries(rules.cardPoints).map(([face, points]) =>
				fmt(countOf(points, r.pointCard), { card: faceName(cards, face) }),
			),
			...(rules.shootTheMoon ? [r.moon] : []),
		],
	};
}

/** Everything a rummy turn allows, given what this player has selected and set aside. */
export function rummyTurn({
	view,
	rules,
	you,
	selected,
	staged,
}: {
	view: RummyView;
	rules: RummyRules;
	you: number | null;
	selected: readonly CardId[];
	staged: readonly (readonly CardId[])[];
}) {
	const live = view.phase === "draw" || view.phase === "play";
	const mine = live && view.turn === you;
	const drawing = mine && view.phase === "draw";
	const playing = mine && view.phase === "play";
	const opened = you !== null && view.opened[you];
	const stagedFlat = staged.flat();
	const inHand = view.hand.filter((card) => !stagedFlat.includes(card));
	const selection = selected.filter((card) => inHand.includes(card));
	const shape =
		selection.length >= rules.minMeldSize
			? buildMeld([...selection], rules)
			: null;
	const shapePoints = shape ? meldPoints(shape, rules) : 0;
	const stagedPoints = staged.reduce((sum, group) => {
		const built = buildMeld([...group], rules);
		return sum + (built ? meldPoints(built, rules) : 0);
	}, 0);
	// Every turn ends on a discard, so laying down can never empty the hand.
	const keepsOne = selection.length < inHand.length;
	const canOpen =
		!opened &&
		staged.length > 0 &&
		shape === null &&
		stagedPoints >= rules.openingPoints &&
		inHand.length > 0;
	// The selection itself reaches the opening, with or without what's set aside.
	const openingWithShape = stagedPoints + shapePoints;
	const canOpenNow =
		playing &&
		!opened &&
		shape !== null &&
		keepsOne &&
		openingWithShape >= rules.openingPoints;
	const singleCard = selection.length === 1 ? selection[0] : null;
	const cantReturn =
		singleCard !== null &&
		singleCard === view.takenDiscard &&
		view.hand.length > 1;
	const canDiscard =
		playing && singleCard !== null && staged.length === 0 && !cantReturn;
	return {
		live,
		mine,
		drawing,
		playing,
		opened,
		inHand,
		selection,
		shape,
		shapePoints,
		stagedPoints,
		keepsOne,
		canOpen,
		openingWithShape,
		canOpenNow,
		singleCard,
		cantReturn,
		canDiscard,
		canTakeDiscard: drawing && rules.takeFromDiscard && view.top !== null,
	};
}

export type RummyTurn = ReturnType<typeof rummyTurn>;

/** What tapping this meld would do with the current selection, if anything. */
export function rummyMeldAction(turn: RummyTurn, meld: Meld) {
	if (!turn.playing || !turn.opened || turn.selection.length === 0) {
		return null;
	}
	// Taking the joker back beats adding the card, as the rules promise.
	if (turn.singleCard && swapJoker(meld, turn.singleCard)) {
		return { type: "swap" as const };
	}
	const order = turn.keepsOne ? fitOnMeld(meld, [...turn.selection]) : null;
	return order ? { type: "add" as const, order } : null;
}

/** What to do now on a rummy turn; null when it isn't this player's turn. */
export function rummyHint(
	turn: RummyTurn,
	view: RummyView,
	rules: RummyRules & MeldRules,
	staged: readonly (readonly CardId[])[],
	messages: Pick<Messages, "serverErrors"> & { words: CardWords },
) {
	const { cards, fmt } = messages.words;
	if (turn.drawing) {
		return rules.takeFromDiscard
			? cards.rummy.drawHint
			: cards.rummy.drawStockHint;
	}
	if (!turn.playing) {
		return null;
	}
	const stagedNote = () =>
		turn.stagedPoints >= rules.openingPoints
			? cards.rummy.stagedHint
			: fmt(cards.rummy.stagedMoreHint, { needed: rules.openingPoints });
	if (!turn.keepsOne && !turn.canDiscard) {
		return messages.serverErrors.cardsKeepOneToDiscard;
	}
	if (turn.cantReturn) {
		return messages.serverErrors.cardsCannotReturnDiscard;
	}
	if (turn.selection.length === 0) {
		return staged.length > 0 ? stagedNote() : cards.rummy.selectHint;
	}
	if (view.melds.some((meld) => rummyMeldAction(turn, meld))) {
		return cards.rummy.tapMeldHint;
	}
	if (turn.selection.length > 1 && turn.shape === null) {
		return cards.rummy.invalidMeld;
	}
	if (turn.canOpenNow) {
		return cards.rummy.openNowHint;
	}
	if (!turn.opened && turn.shape !== null) {
		return fmt(cards.rummy.openingNeeded, { needed: rules.openingPoints });
	}
	return staged.length > 0 ? stagedNote() : cards.rummy.discardHint;
}

/** Everything a gin turn allows, given what this player has selected. */
export function ginTurn({
	view,
	rules,
	you,
	selected,
}: {
	view: GinView;
	rules: GinRules;
	you: number | null;
	selected: readonly CardId[];
}) {
	const live =
		view.phase === "draw" || view.phase === "play" || view.phase === "layoff";
	const mine = live && view.turn === you;
	const drawing = mine && view.phase === "draw";
	const playing = mine && view.phase === "play";
	const layingOff = mine && view.phase === "layoff";
	const selection = selected.filter((card) => view.hand.includes(card));
	const singleCard = selection.length === 1 ? selection[0] : null;
	const cantReturn = singleCard !== null && singleCard === view.takenDiscard;
	const canDiscard = playing && singleCard !== null && !cantReturn;
	const knockDeadwood = canDiscard
		? arrangeHand(
				view.hand.filter((card) => card !== singleCard),
				rules,
			).points
		: null;
	const canKnock = knockDeadwood !== null && knockDeadwood <= rules.knockLimit;
	// With eleven cards the count that matters is what the best discard leaves;
	// while laying off, it's what the hand would leave to score now.
	const deadwood =
		you === null || !live
			? null
			: playing
				? (bestDiscard(view.hand, rules, view.takenDiscard)?.points ?? 0)
				: arrangeHand(view.hand, rules).points;
	return {
		live,
		mine,
		drawing,
		playing,
		layingOff,
		selection,
		singleCard,
		cantReturn,
		canDiscard,
		knockDeadwood,
		canKnock,
		gin: canKnock && knockDeadwood === 0,
		knockPossible: playing && deadwood !== null && deadwood <= rules.knockLimit,
		deadwood,
		canTakeDiscard: drawing && view.top !== null,
	};
}

export type GinTurn = ReturnType<typeof ginTurn>;

/** The order the selection lays off onto this meld, or null when it can't. */
export function ginLayoffOrder(turn: GinTurn, meld: Meld) {
	if (!turn.layingOff || turn.selection.length === 0) {
		return null;
	}
	return fitLayoff(meld, turn.selection)?.order ?? null;
}

/** What to do now on a gin turn; null when it isn't this player's turn. */
export function ginHint(
	turn: GinTurn,
	view: GinView,
	{
		cards,
		fmt,
		serverErrors,
		knocker,
	}: Pick<CardWords, "cards" | "fmt"> &
		Pick<Messages, "serverErrors"> & { knocker: string },
) {
	if (turn.drawing) {
		return cards.gin.drawHint;
	}
	if (turn.layingOff) {
		if (turn.selection.length === 0) {
			return fmt(cards.gin.layoffHint, { name: knocker });
		}
		return view.melds.some((meld) => ginLayoffOrder(turn, meld))
			? cards.gin.layoffTapMeld
			: cards.gin.layoffNoFit;
	}
	if (!turn.playing) {
		return null;
	}
	if (turn.cantReturn) {
		return serverErrors.cardsCannotReturnDiscard;
	}
	if (turn.selection.length > 1) {
		return cards.gin.oneCard;
	}
	if (turn.singleCard === null) {
		return turn.knockPossible ? cards.gin.canKnockHint : cards.gin.pickDiscard;
	}
	if (turn.gin) {
		return cards.gin.ginHint;
	}
	return turn.canKnock
		? fmt(cards.gin.knockHint, { deadwood: turn.knockDeadwood ?? 0 })
		: cards.gin.discardHint;
}

/** The hand as its best melds, then the deadwood by suit: how a gin player holds it. */
export function groupGinHand(hand: readonly CardId[], rules: GinRules) {
	const arranged = arrangeHand(hand, rules);
	return [
		// A run keeps its own order, so A-2-3 doesn't sort its ace to the end.
		...arranged.melds.flatMap((meld) =>
			meld.kind === "run" ? meld.cards : sortCards(meld.cards, "suit"),
		),
		...sortCards(arranged.deadwood, "suit"),
	];
}

/** The newest event number, or null for an empty log. */
export function newestSeq(events: readonly CardEvent[]): number | null {
	return events.at(-1)?.seq ?? null;
}

/** A rematch restarts the event log, so its newest number drops below the last one seen. */
export function logRestarted(newest: number | null, previous: number | null) {
	return newest !== null && previous !== null && newest < previous;
}

export type FreshCardsMemory = {
	hand: readonly CardId[] | null;
	mine: boolean;
	dealSeq: number | null;
	newestSeq: number | null;
	fresh: readonly CardId[];
};

export function startFreshCards(mine: boolean): FreshCardsMemory {
	return { hand: null, mine, dealSeq: null, newestSeq: null, fresh: [] };
}

/**
 * The cards that just arrived in a hand, so a draw can be found in a sorted fan.
 * They stay marked until the player's next turn begins. A new deal marks nothing:
 * a rematch restarts the event log, so its newest event number drops.
 */
export function nextFreshCards(
	memory: FreshCardsMemory,
	hand: readonly CardId[],
	mine: boolean,
	events: readonly CardEvent[],
): FreshCardsMemory {
	const turnBegan = mine && !memory.mine;
	const dealSeq = [...events]
		.reverse()
		.find((event) => event.type === "deal")?.seq;
	const newest = newestSeq(events);
	const dealt =
		(dealSeq !== undefined && dealSeq !== memory.dealSeq) ||
		logRestarted(newest, memory.newestSeq);
	const before = memory.hand;
	const added =
		before && !dealt ? hand.filter((card) => !before.includes(card)) : [];
	const kept =
		turnBegan || dealt
			? []
			: memory.fresh.filter((card) => hand.includes(card));
	return {
		hand,
		mine,
		dealSeq: dealSeq ?? memory.dealSeq,
		newestSeq: newest,
		fresh: [...kept, ...added],
	};
}

/** Where a card can travel: a seat, the player's hand, the piles, or a meld. */
export type FlightZone =
	| "hand"
	| "stock"
	| "discard"
	| `seat-${number}`
	| `meld-${number}`;

export type PlannedFlight = {
	card: CardId | null;
	from: FlightZone;
	to: FlightZone;
	/** Milliseconds after the batch starts. */
	delay: number;
	/** The card has a known spot in this player's hand to leave from. */
	fromHandCard: boolean;
};

const FLIGHT_STEP_MS = 60;
const MAX_CARDS_PER_EVENT = 6;
const DEAL_CARDS_PER_SEAT = 3;

/** The events since `previousSeq`. A rematch restarts the count, so all are then new. */
export function eventsSince(
	events: readonly CardEvent[],
	previousSeq: number,
): readonly CardEvent[] {
	return logRestarted(newestSeq(events) ?? 0, previousSeq)
		? events
		: events.filter((event) => event.seq > previousSeq);
}

/** Turns events into cards crossing the table, and the seat to bump, if any. */
export function planFlights(
	events: readonly CardEvent[],
	{
		you,
		seatCount,
		meldCard,
	}: {
		you: number | null;
		seatCount: number;
		meldCard: (meldId: number) => CardId | null;
	},
) {
	const seatZone = (seat: number): FlightZone =>
		seat === you ? "hand" : `seat-${seat}`;
	const flights: PlannedFlight[] = [];
	let delay = 0;
	let flash: number | null = null;
	const fly = (
		card: CardId | null,
		from: FlightZone,
		to: FlightZone,
		fromHandCard = false,
	) => {
		flights.push({ card, from, to, delay, fromHandCard });
		delay += FLIGHT_STEP_MS;
	};
	const flyBacks = (count: number, from: FlightZone, seat: number) => {
		for (let i = 0; i < Math.min(count, MAX_CARDS_PER_EVENT); i += 1) {
			fly(null, from, seatZone(seat));
		}
	};
	for (const event of events) {
		switch (event.type) {
			case "deal":
				for (let round = 0; round < DEAL_CARDS_PER_SEAT; round += 1) {
					for (let seat = 0; seat < seatCount; seat += 1) {
						fly(null, "stock", seatZone(seat));
					}
				}
				break;
			case "play":
			case "discard":
				fly(event.card, seatZone(event.seat), "discard", event.seat === you);
				delay += FLIGHT_STEP_MS;
				break;
			case "draw":
				flyBacks(
					event.count,
					event.source === "discard" ? "discard" : "stock",
					event.seat,
				);
				break;
			case "penalty":
			case "caught":
			case "finishPenalty":
				flyBacks(event.count, "stock", event.seat);
				break;
			case "meld":
				for (const id of event.meldIds) {
					fly(meldCard(id), seatZone(event.seat), `meld-${id}`);
				}
				break;
			case "layoff":
				fly(
					event.cards[0] ?? null,
					seatZone(event.seat),
					`meld-${event.meldId}`,
				);
				break;
			case "swap":
				fly(event.card, seatZone(event.seat), `meld-${event.meldId}`);
				break;
			case "exchange":
				for (let seat = 0; seat < seatCount; seat += 1) {
					for (
						let i = 0;
						i < Math.min(event.count, MAX_CARDS_PER_EVENT);
						i += 1
					) {
						fly(
							null,
							seatZone(seat),
							seatZone((seat + event.shift) % seatCount),
						);
					}
				}
				break;
			case "skip":
			case "again":
			case "trickWon":
				flash = event.seat;
				break;
			default:
				break;
		}
	}
	return { flights, flash };
}
