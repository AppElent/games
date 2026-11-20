/**
 * What every client derives the same way from a table: names, sentences, the
 * order of seats, which moves a selection allows, which cards just arrived, and
 * which cards cross the table. No drawing and no framework.
 */
import type { Messages } from "../i18n/en";
import type { BankView } from "./bank";
import {
	type CardId,
	cardFace,
	parseCard,
	RANKS,
	SUITS,
	type Suit,
} from "./deck";
import {
	addedCardOptions,
	type CardGameDefinition,
	generalOptions,
	houseRuleApplies,
	plainCardOption,
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
import { rankIndex, type TricksRules, type TricksView } from "./tricks";

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

/** The computer is playing this device's seat, so it must not offer moves of its own. */
export function onAutopilot(table: TableSeats): boolean {
	return table.you !== null && table.seats[table.you]?.autopilot === true;
}

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
	/** What it does, and from how many players when that matters. */
	effect: string;
	/** The house rule its switch sets, or null when the game offers none. */
	option: string | null;
	/** Choosing `option` gives the card its power; otherwise it makes the card plain. */
	adds: boolean;
	/** The switch counts only from this many players. */
	minPlayers: number | null;
};

/** A rule's hint, with the player count it needs when it has one. */
export function playerCountHint(
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
	hint: string,
	minPlayers: number | undefined,
) {
	return minPlayers === undefined
		? hint
		: `${hint.replace(/\.$/, "")}. ${fmt(cards.setup.fromPlayers, { count: minPlayers })}`;
}

function gameText(cards: CardMessages, game: CardGameDefinition) {
	return cards.games[game.id as keyof CardMessages["games"]];
}

/**
 * Every special card a game can deal, before house rules: the ones it plays
 * with and the ones a house rule adds, so a setup screen can list them all and
 * switch each one.
 */
export function specialCards(
	words: Pick<CardWords, "cards" | "fmt">,
	game: CardGameDefinition,
): SpecialCard[] {
	if (game.family !== "shedding") {
		return [];
	}
	const rules = game.rules as SheddingRules;
	const names = gameText(words.cards, game).powers as Record<string, string>;
	const card = (
		key: string,
		power: CardPower,
		option: { id: string; minPlayers?: number } | undefined,
		adds: boolean,
	): SpecialCard => ({
		key,
		sample: key === "joker" ? "JK#0" : `S${key}#0`,
		name: names[key] ?? key,
		effect: playerCountHint(
			words,
			powerEffect(words, rules, power),
			option?.minPlayers,
		),
		option: option?.id ?? null,
		adds,
		minPlayers: option?.minPlayers ?? null,
	});
	return [
		...Object.entries(rules.powers).map(([key, power]) =>
			card(key, power as CardPower, plainCardOption(game, key), false),
		),
		...addedCardOptions(game).flatMap((option) =>
			Object.entries(option.withPowers).map(([key, power]) =>
				card(key, power as CardPower, option, true),
			),
		),
	];
}

/**
 * How a special card's switch reads: on while the card has its power, and
 * disabled when the game offers no rule for it or the table is too small.
 * `seats` is null while friends are still joining.
 */
export function specialCardSwitch(
	card: SpecialCard,
	chosen: readonly string[],
	seats: number | null,
) {
	const available = houseRuleApplies(
		{ minPlayers: card.minPlayers ?? undefined },
		seats,
	);
	const picked =
		available && card.option !== null && chosen.includes(card.option);
	return {
		on: card.adds ? picked : !picked,
		disabled: card.option === null || !available,
	};
}

/**
 * A game's other house rules as switches. One that needs more players than
 * the table has is disabled and reads off; `seats` is null while friends are
 * still joining, which leaves every switch open.
 */
export function houseRuleSwitches(
	words: Pick<CardWords, "cards" | "fmt">,
	game: CardGameDefinition,
	seats: number | null,
) {
	const text = gameText(words.cards, game).options as Record<
		string,
		{ label: string; hint: string }
	>;
	return generalOptions(game).map((option) => ({
		id: option.id,
		label: text[option.id].label,
		hint: playerCountHint(words, text[option.id].hint, option.minPlayers),
		disabled: !houseRuleApplies(option, seats),
	}));
}

/** A chosen house rule's name, with the player count it waits for when the table is still too small. */
export function houseRuleLabel(
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
	game: CardGameDefinition,
	id: string,
	seats: number,
) {
	const label = (
		gameText(cards, game).options as Record<string, { label: string }>
	)[id]?.label;
	const option = (
		game.options as ReadonlyArray<{ id: string; minPlayers?: number }>
	).find((rule) => rule.id === id);
	if (!label || !option || houseRuleApplies(option, seats)) {
		return label;
	}
	return fmt(cards.lobby.fromPlayers, {
		rule: label,
		count: option.minPlayers ?? 0,
	});
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
	const team = (seats: readonly number[]) => seats.map(name).join(" & ");
	const yours = (seats: readonly number[]) =>
		table.you !== null && seats.includes(table.you);
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
		case "bid":
			return mine(event.seat)
				? fmt(e.youBid, { count: event.count })
				: fmt(e.bid, { name: name(event.seat), count: event.count });
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
		case "raise":
			if (event.seat === null) {
				return fmt(e.lastLifeRaise, { stake: event.stake });
			}
			return mine(event.seat)
				? fmt(e.youRaise, { stake: event.stake })
				: fmt(e.raise, { stake: event.stake, name: name(event.seat) });
		case "stay":
			return mine(event.seat)
				? e.youStay
				: fmt(e.stay, { name: name(event.seat) });
		case "fold":
			return mine(event.seat)
				? countOf(event.cost, e.youFold)
				: fmt(countOf(event.cost, e.fold), { name: name(event.seat) });
		case "swapHand":
			return mine(event.seat)
				? e.youSwapHand
				: fmt(e.swapHand, { name: name(event.seat) });
		case "dealWon":
			return mine(event.seat)
				? e.youDealWon
				: fmt(e.dealWon, { name: name(event.seat) });
		case "out":
			return mine(event.seat)
				? e.youOut
				: fmt(e.out, { name: name(event.seat) });
		case "trumpPass":
			return mine(event.seat)
				? e.youTrumpPass
				: fmt(e.trumpPass, { name: name(event.seat) });
		case "trump":
			return fmt(mine(event.seat) ? e.youTrump : e.trump, {
				name: name(event.seat),
				suit: cards.suits[event.suit],
			});
		case "roem":
			return fmt(mine(event.seat) ? e.youRoem : e.roem, {
				name: name(event.seat),
				count: event.points,
			});
		case "nat":
			return yours(event.seats)
				? e.youNat
				: fmt(e.nat, { name: team(event.seats) });
		case "pit":
			return yours(event.seats)
				? e.youPit
				: fmt(e.pit, { name: team(event.seats) });
		case "win":
			if (event.seats.length > 1) {
				return fmt(e.winTie, { name: event.seats.map(name).join(" & ") });
			}
			return mine(event.seats[0])
				? e.youWin
				: fmt(e.win, { name: name(event.seats[0]) });
		case "stake":
			return mine(event.seat)
				? countOf(event.amount, e.youStake)
				: fmt(countOf(event.amount, e.stake), { name: name(event.seat) });
		case "natural":
			return mine(event.seat)
				? e.youNatural
				: fmt(e.natural, { name: name(event.seat) });
		case "hit":
		case "double": {
			const params = {
				card: cardName(cards, event.card),
				total: event.total,
				name: name(event.seat),
			};
			const [yours, theirs] =
				event.type === "hit" ? [e.youHit, e.hit] : [e.youDouble, e.double];
			return fmt(mine(event.seat) ? yours : theirs, params);
		}
		case "stand":
			return mine(event.seat)
				? fmt(e.youStand, { total: event.total })
				: fmt(e.stand, { total: event.total, name: name(event.seat) });
		case "bust":
			return mine(event.seat)
				? e.youBust
				: fmt(e.bust, { name: name(event.seat) });
		case "bankReveal":
		case "bankDraw":
			return fmt(event.type === "bankReveal" ? e.bankReveal : e.bankDraw, {
				card: cardName(cards, event.card),
				total: event.total,
			});
		case "settle": {
			const result = table.you === null ? null : event.results[table.you];
			if (result === null || result === undefined) {
				return fmt(e.settle, { round: event.round });
			}
			if (result === 0) {
				return e.settleYouEven;
			}
			return countOf(
				Math.abs(result),
				result > 0 ? e.settleYouWin : e.settleYouLose,
			);
		}
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

/** Partners share a total: a game where some seats share a team. */
export function isTeamGame(view: Pick<TricksView, "teams">) {
	return new Set(view.teams).size < view.teams.length;
}

export type TricksTeam = {
	team: number;
	seats: number[];
	/** The match total, which every seat of the team shares. */
	total: number;
	/** Card points and roem taken so far this deal. */
	points: number;
	roem: number;
	yours: boolean;
};

/** The teams at the table, the viewer's own first. */
export function tricksTeams(
	view: Pick<TricksView, "teams" | "totals" | "roundPoints" | "roem">,
	you: number | null,
): TricksTeam[] {
	const ids = [...new Set(view.teams)];
	const sum = (values: readonly number[], seats: readonly number[]) =>
		seats.reduce((total, seat) => total + (values[seat] ?? 0), 0);
	const teams = ids.map((team) => {
		const seats = view.teams.flatMap((own, seat) =>
			own === team ? [seat] : [],
		);
		return {
			team,
			seats,
			total: view.totals[seats[0]] ?? 0,
			points: sum(view.roundPoints, seats),
			roem: sum(view.roem, seats),
			yours: you !== null && seats.includes(you),
		};
	});
	return [...teams].sort((a, b) => Number(b.yours) - Number(a.yours));
}

/** A team as its players' names: "You & Anna". */
export function teamName(
	cards: CardMessages,
	table: TableSeats,
	seats: readonly number[],
) {
	return seats.map((seat) => seatName(cards, table, seat)).join(" & ");
}

type TricksScoreView = Pick<
	TricksView,
	"teams" | "totals" | "roundPoints" | "roem" | "scores" | "deals"
>;

/** Where the match stands: "Round 3 of 16 · 8 cards", or "Round 2 · to 100". */
export function tricksRoundLabel(
	view: Pick<
		TricksView,
		"round" | "deals" | "target" | "handSize" | "matchEnd"
	>,
	{ cards, fmt, countOf }: CardWords,
) {
	const t = cards.tricks;
	if (view.deals !== null) {
		return `${fmt(t.dealLabel, { round: view.round, deals: view.deals })} · ${countOf(view.handSize, t.cardsEach)}`;
	}
	return fmt(
		view.matchEnd === "lastStanding" ? t.outRoundLabel : t.roundLabel,
		{ round: view.round, target: view.target ?? "" },
	);
}

/** The scoreboard's rows: one per team in a team game, else one per seat. */
export function tricksScoreRows(
	view: TricksScoreView,
	table: TableSeats,
	cards: CardMessages,
) {
	if (!isTeamGame(view)) {
		return {
			labels: table.seats.map((_, seat) => seatName(cards, table, seat)),
			scores: view.scores,
			totals: view.totals,
		};
	}
	const teams = tricksTeams(view, table.you);
	return {
		labels: teams.map((team) => teamName(cards, table, team.seats)),
		scores: view.scores.map((deal) => teams.map((team) => deal[team.seats[0]])),
		totals: teams.map((team) => team.total),
	};
}

/** The final order, best first, by team in a team game. */
export function tricksStandings(
	view: TricksScoreView,
	table: TableSeats,
	cards: CardMessages,
	highest: boolean,
) {
	const rows = tricksScoreRows(view, table, cards);
	const best = highest ? Math.max(...rows.totals) : Math.min(...rows.totals);
	return rows.labels
		.map((label, row) => ({
			row,
			label,
			total: rows.totals[row],
			best: rows.totals[row] === best,
		}))
		.sort((a, b) => (highest ? b.total - a.total : a.total - b.total));
}

/** The end screen's headline. */
export function tricksMatchTitle(
	view: Pick<TricksView, "teams" | "winners">,
	table: TableSeats,
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
) {
	const t = cards.tricks;
	const you = table.you;
	const won = you !== null && view.winners.includes(you);
	if (isTeamGame(view)) {
		if (view.winners.length === view.teams.length) {
			return t.matchTie;
		}
		return won
			? t.matchYourTeamWins
			: fmt(t.matchTeamWinner, {
					team: teamName(cards, table, view.winners),
				});
	}
	if (view.winners.length > 1) {
		return t.matchTie;
	}
	return won
		? t.matchYouWin
		: fmt(t.matchWinner, { name: seatName(cards, table, view.winners[0]) });
}

/** How the last deal went for each team, and its nat or pit headline. */
export function tricksDealSummary(
	view: Pick<TricksView, "teams" | "lastDeal">,
	table: TableSeats,
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
) {
	const deal = view.lastDeal;
	if (!deal) {
		return null;
	}
	const t = cards.tricks;
	const seatsOf = (team: number) =>
		view.teams.flatMap((own, seat) => (own === team ? [seat] : []));
	const yours = (team: number) =>
		table.you !== null && view.teams[table.you] === team;
	const headline = (
		team: number | null,
		mine: string,
		theirs: string,
	): string | null =>
		team === null
			? null
			: yours(team)
				? mine
				: fmt(theirs, { team: teamName(cards, table, seatsOf(team)) });
	const order = deal.scores
		.map((_, team) => team)
		.sort((a, b) => Number(yours(b)) - Number(yours(a)));
	return {
		headlines: [
			headline(deal.nat ? deal.maker : null, t.youNat, t.nat),
			headline(deal.pit, t.youPit, t.pit),
		].filter((line): line is string => line !== null),
		teams: order.map((team) => ({
			team,
			label: teamName(cards, table, seatsOf(team)),
			detail: fmt(t.teamPoints, {
				points: deal.points[team],
				roem: deal.roem[team],
			}),
			score: deal.scores[team],
		})),
	};
}

/** A hand in suits, each from weak to strong in this game's order (trumps by `trumpRanks`). */
export function sortTricksHand(
	hand: readonly CardId[],
	rules: Pick<TricksRules, "ranks" | "trumpRanks">,
	trump: Suit | null,
) {
	return [...hand].sort(
		(a, b) =>
			suitOrder(a) - suitOrder(b) ||
			rankIndex(rules, a, trump) - rankIndex(rules, b, trump),
	);
}

/** What to do now in a trick-taking deal; null when there's nothing for this seat to do. */
export function tricksHint(
	view: TricksView,
	you: number | null,
	{ cards, fmt, countOf }: Pick<CardWords, "cards" | "fmt" | "countOf">,
	rules: Pick<TricksRules, "firstLead" | "breaking" | "mustTrump">,
) {
	const t = cards.tricks;
	if (you === null) {
		return null;
	}
	if (view.out[you]) {
		return view.phase === "finished" ? null : t.outHint;
	}
	const knock = view.knock;
	if (view.phase === "knocking" && knock) {
		if (!knock.asked.includes(you) || knock.answers[you] !== null) {
			return t.knockWaiting;
		}
		const stake = view.stake ?? 1;
		return fmt(
			countOf(stake - 1, knock.by === null ? t.lastLifeAnswer : t.knockAnswer),
			{ stake },
		);
	}
	if (view.folded[you] && view.phase === "playing") {
		return t.foldedHint;
	}
	if (view.canSwap && view.turn !== you) {
		return t.swapHint;
	}
	if (view.phase === "trump") {
		if (view.turn !== you) {
			return null;
		}
		if (view.offered) {
			return fmt(t.trumpOfferHint, { suit: cards.suits[view.offered] });
		}
		return view.trumpPassed.every(Boolean)
			? t.trumpForcedHint
			: t.trumpChooseHint;
	}
	if (view.phase === "bidding") {
		if (view.turn !== you) {
			return null;
		}
		return view.blockedBid !== null
			? fmt(t.bidDealer, { count: view.blockedBid })
			: fmt(t.bidHint, { count: view.handSize });
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
	const suitOf = (card: CardId) => parseCard(card).suit;
	const led = view.trick[0]?.card;
	if (led) {
		const ledSuit = suitOf(led) as Suit;
		const suit = cards.suits[ledSuit];
		const following = view.legal.some((card) => suitOf(card) === ledSuit);
		const trump = view.trump;
		if (rules.mustTrump && trump) {
			const trumps = view.hand.filter((card) => suitOf(card) === trump);
			if (following && ledSuit === trump && view.legal.length < trumps.length) {
				return t.overtrump;
			}
			if (!following) {
				const onlyTrumps = view.legal.every((card) => suitOf(card) === trump);
				if (onlyTrumps && trumps.length < view.hand.length) {
					const trumped = view.trick.some(
						(play) => suitOf(play.card) === trump,
					);
					return fmt(trumped ? t.voidOvertrump : t.voidTrump, { suit });
				}
				if (view.legal.length < view.hand.length) {
					return fmt(t.voidNoUndertrump, { suit });
				}
			}
		}
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
		view.hand.some((card) => suitOf(card) === breaking.suit) &&
		view.legal.every((card) => suitOf(card) !== breaking.suit)
	) {
		return fmt(t.leadNotBroken, { suit: cards.suits[breaking.suit] });
	}
	return t.lead;
}

/** The bids made so far this deal, added up; null for a game without bidding. */
export function bidTotal(view: Pick<TricksView, "bids">) {
	return view.bids
		? view.bids.reduce<number>((sum, bid) => sum + (bid ?? 0), 0)
		: null;
}

/**
 * The line under a seat: passed while cards (or a trump) are being chosen;
 * in a team game partner and who plays, as the team strip carries the points;
 * in a bidding game its tricks against its bid; else its points.
 */
export function tricksSeatNote(
	view: Pick<
		TricksView,
		| "phase"
		| "passReady"
		| "totals"
		| "roundPoints"
		| "target"
		| "stake"
		| "folded"
		| "out"
		| "knock"
		| "bids"
		| "tricksTaken"
		| "teams"
		| "trumpPassed"
		| "maker"
	>,
	seat: number,
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
	you: number | null = null,
) {
	const t = cards.tricks;
	if (view.phase === "passing" && view.passReady[seat]) {
		return t.passedNote;
	}
	if (view.stake !== null) {
		const points = fmt(t.penaltyNote, {
			total: view.totals[seat],
			target: view.target ?? "",
		});
		const knock = view.knock;
		const status = view.out[seat]
			? t.outNote
			: view.folded[seat]
				? t.foldedNote
				: knock?.by === seat
					? t.knockedNote
					: knock?.asked.includes(seat)
						? knock.answers[seat] === "stay"
							? t.stayedNote
							: t.decidingNote
						: null;
		return status ? `${points} · ${status}` : points;
	}
	if (view.phase === "trump" && view.trumpPassed[seat]) {
		return t.trumpPassedNote;
	}
	if (isTeamGame(view)) {
		const partner =
			you !== null && seat !== you && view.teams[seat] === view.teams[you];
		return [
			partner ? t.partnerNote : null,
			view.maker === seat && view.phase !== "trump" ? t.makerNote : null,
		]
			.filter(Boolean)
			.join(" · ");
	}
	if (view.bids) {
		const bid = view.bids[seat];
		const total = view.totals[seat];
		if (bid === null) {
			return fmt(cards.tricks.seatTotal, { total });
		}
		return view.phase === "bidding"
			? fmt(cards.tricks.seatBid, { bid, total })
			: fmt(cards.tricks.seatTricks, {
					bid,
					taken: view.tricksTaken[seat],
					total,
				});
	}
	const round = view.roundPoints[seat];
	return fmt(t.seatScore, {
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
	const highToLow = (ranks: readonly (typeof RANKS)[number][]) =>
		[...ranks].reverse().map(glyph).join(" ");
	const pointList = (
		ranks: readonly (typeof RANKS)[number][],
		points: Readonly<Partial<Record<(typeof RANKS)[number], number>>>,
	) =>
		[...ranks]
			.reverse()
			.flatMap((rank) =>
				points[rank] ? [`${glyph(rank)} ${points[rank]}`] : [],
			)
			.join(", ");
	const breaking = rules.breaking;
	const lastTrick = rules.scoring === "lastTrick";
	const ranks = (set: readonly (typeof RANKS)[number][]) =>
		set.map(glyph).join(" ");
	const trumpRanks = rules.trumpRanks;
	const called = rules.callTrump === true;
	const bidding = rules.bidding ?? null;
	const target = rules.target;
	const outLimit = rules.matchEnd === "lastStanding" ? target : null;
	const end = lastTrick
		? r.goalLastTrick
		: rules.deals
			? fmt(r.goalDeals, { deals: rules.deals })
			: target === null
				? rules.highWins
					? r.goalLastHigh
					: r.goalLastLow
				: fmt(rules.highWins ? r.goalHigh : r.goal, { target });
	return {
		goal: [
			...(rules.seating === "opposite" ? [r.teams] : []),
			end,
			...(outLimit === null ? [] : [fmt(r.out, { target: outLimit })]),
		].join(" "),
		/** Null when the game bids instead of passing. */
		bidding: bidding
			? [
					...(rules.schedule === "fullDeck" || rules.schedule === "fourEach"
						? []
						: [r.schedules[rules.schedule]]),
					...(rules.maxHand === undefined
						? []
						: [fmt(r.maxHand, { max: rules.maxHand })]),
					r.bid,
					...(bidding.dealerMayMatch ? [] : [r.dealerRule]),
				]
			: null,
		/** Null when the game bids, calls trump or plays for stakes instead of passing. */
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
			: bidding || called || rules.knocking
				? null
				: [r.noPass],
		stakes: rules.knocking
			? [
					r.stake,
					r.knock,
					r.fold,
					r.knockAgain,
					...(outLimit === null
						? []
						: [fmt(r.knockLimit, { target: outLimit })]),
					...(rules.knocking.lastLife ? [r.lastLife] : []),
					...(rules.swapHands ?? []).map((set) =>
						fmt(r.swap, { ranks: ranks(set) }),
					),
				]
			: [],
		trump: called
			? [rules.trumpChoice === "none" ? r.nameTrump : r.callTrump, r.makerMust]
			: [],
		turn: [
			...(rules.trumpChoice === "turnUp" ? [r.trumpTurnUp] : []),
			rules.firstLead
				? fmt(r.firstLead, { card: faceName(cards, rules.firstLead) })
				: r.leftLeads,
			...(rules.mustTrump
				? [
						r.mustTrump,
						...(rules.mustTrump === "unlessPartnerWins" ? [r.partnerWins] : []),
					]
				: [r.follow]),
			rules.trumpChoice === "none" && !called ? r.trick : r.trickTrump,
			...(lastTrick ? [r.lastTrickOnly] : []),
			...(trumpRanks
				? [
						fmt(r.trumpRanks, { ranks: highToLow(trumpRanks) }),
						fmt(r.otherRanks, { ranks: highToLow(rules.ranks) }),
					]
				: [fmt(r.ranks, { ranks: highToLow(rules.ranks) })]),
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
			...(bidding
				? [
						fmt(r.bidMet, {
							exact: bidding.exact,
							perTrick: bidding.perTrick,
						}),
						fmt(r.bidMissed, { perTrickOff: bidding.perTrickOff }),
					]
				: []),
			...(rules.trumpPoints
				? [
						fmt(r.trumpPoints, {
							list: pointList(trumpRanks ?? rules.ranks, rules.trumpPoints),
						}),
					]
				: []),
			...(rules.rankPoints
				? [
						fmt(r.otherPoints, {
							list: pointList(rules.ranks, rules.rankPoints),
						}),
					]
				: []),
			...Object.entries(rules.suitPoints).map(([suit, points]) =>
				fmt(countOf(points as number, r.pointSuit), {
					suit: cards.suits[suit as Suit],
				}),
			),
			...Object.entries(rules.cardPoints).map(([face, points]) =>
				fmt(countOf(points, r.pointCard), { card: faceName(cards, face) }),
			),
			...(rules.lastTrickBonus
				? [fmt(r.lastTrick, { count: rules.lastTrickBonus })]
				: []),
			...(rules.shootTheMoon ? [r.moon] : []),
		],
		roem: rules.roem
			? [
					r.roemTaker,
					r.roemRuns,
					r.roemStuk,
					r.roemSquare,
					...(rules.pitBonus ? [fmt(r.pit, { count: rules.pitBonus })] : []),
				]
			: [],
	};
}

/** Empty places left in the open trick: seats still in the deal that have yet to play. */
export function openTrickSlots(
	view: Pick<TricksView, "phase" | "trick" | "folded" | "out">,
) {
	if (view.phase !== "playing") {
		return 0;
	}
	const played = new Set(view.trick.map((play) => play.seat));
	return view.out.filter(
		(out, seat) => !out && !view.folded[seat] && !played.has(seat),
	).length;
}

/** The stake buttons this seat gets now: knock, answer a knock, or swap its hand. */
export function tricksChoices(view: TricksView, you: number | null) {
	const knock = view.knock;
	return {
		knock: view.canKnock,
		answer:
			you !== null &&
			view.phase === "knocking" &&
			knock?.asked.includes(you) === true &&
			knock.answers[you] === null,
		swap: view.canSwap,
	};
}

/** How the match is won, for the scores sheet. */
export function tricksWinsLine(
	view: Pick<TricksView, "target" | "matchEnd">,
	rules: Pick<TricksRules, "highWins">,
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
) {
	const t = cards.tricks;
	if (view.matchEnd === "lastStanding" && view.target !== null) {
		return fmt(t.lastStanding, { target: view.target });
	}
	return rules.highWins ? t.highestWins : t.lowestWins;
}

/** The rules sheet's sections after the goal, leaving out any with nothing to say. */
export function tricksRuleSections(
	lines: ReturnType<typeof tricksRuleLines>,
	cards: CardMessages,
) {
	const r = cards.rules;
	return [
		{ heading: r.trumpHeading, lines: lines.trump },
		{ heading: r.bidHeading, lines: lines.bidding },
		{ heading: r.passHeading, lines: lines.passing },
		{ heading: r.stakesHeading, lines: lines.stakes },
		{ heading: r.turnHeading, lines: lines.turn },
		{ heading: r.pointsHeading, lines: lines.points },
		{ heading: r.roemHeading, lines: lines.roem },
	].flatMap(({ heading, lines }) =>
		lines && lines.length > 0 ? [{ heading, lines }] : [],
	);
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

/** What to do now at a bank table; null when there is nothing for this player to do. */
export function bankHint(
	view: BankView,
	you: number | null,
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
	/** The last round's result is still on show, before the next stakes. */
	paused = false,
) {
	if (you === null || view.phase === "finished") {
		return null;
	}
	if (view.phase === "stake") {
		if (paused) {
			return fmt(cards.bank.roundSettled, { round: view.round - 1 });
		}
		return view.canStake ? cards.bank.stakeHint : cards.bank.stakeWaiting;
	}
	if (view.turn !== you) {
		return null;
	}
	return fmt(cards.bank.playHint, { total: view.handTotals[you] });
}

/** Face-up cards as short marks ("K♠ 7♥") plus the spoken names for a screen reader. */
export function faceUpCards(cards: CardMessages, ids: readonly CardId[]) {
	const marks = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;
	const text = ids
		.map((id) => {
			const card = parseCard(id);
			if (card.joker) {
				return cards.joker;
			}
			const rank = (cards.rankGlyphs as Record<string, string>)[card.rank];
			return `${rank ?? card.rank}${marks[card.suit]}`;
		})
		.join(" ");
	return { text, label: ids.map((id) => cardName(cards, id)).join(", ") };
}

/** How long a settled round stays on screen before the next round's points are picked. */
export const ROUND_PAUSE_MS = 2500;

/** Points won or lost in a round, signed: "+3", "−2" or "±0". */
export function signedPoints(
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
	points: number,
) {
	if (points === 0) {
		return cards.bank.resultEven;
	}
	return fmt(points > 0 ? cards.bank.resultWin : cards.bank.resultLose, {
		count: Math.abs(points),
	});
}

/**
 * A player's line at a bank table: their total and what the hand is played
 * for, or last round's result while the next one is being picked.
 */
export function bankSeatNote(
	words: Pick<CardWords, "cards" | "fmt" | "countOf">,
	view: BankView,
	seat: number,
) {
	const { cards, countOf } = words;
	const stake = view.stakes[seat];
	if (view.phase !== "play") {
		const last = view.results.at(-1)?.[seat];
		return last === undefined ? "" : signedPoints(words, last);
	}
	const total = view.handTotals[seat];
	const state =
		total > 21
			? cards.bank.over
			: view.hands[seat].length === 2 && total === 21
				? cards.bank.natural
				: String(total);
	return stake === null
		? state
		: `${state} · ${countOf(stake, cards.bank.playingFor)}`;
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

/**
 * Which meld each card of a hand sits in, numbered from 1 in the order
 * `groupGinHand` lays them out. Deadwood has no entry.
 */
export function ginMeldMarks(hand: readonly CardId[], rules: GinRules) {
	const marks = new Map<CardId, number>();
	arrangeHand(hand, rules).melds.forEach((meld, index) => {
		for (const card of meld.cards) {
			marks.set(card, index + 1);
		}
	});
	return marks;
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

/** Where a card can travel: a seat, the player's hand, the piles, a meld, or the bank. */
export type FlightZone =
	| "hand"
	| "stock"
	| "discard"
	| "bank"
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
				for (
					let pass = 0;
					pass < (event.perSeat ?? DEAL_CARDS_PER_SEAT);
					pass += 1
				) {
					for (let seat = 0; seat < seatCount; seat += 1) {
						if (!event.skipped?.includes(seat)) {
							fly(null, "stock", seatZone(seat));
						}
					}
					if (event.bank) {
						fly(null, "stock", "bank");
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
			case "hit":
			case "double":
				fly(event.card, "stock", seatZone(event.seat));
				break;
			case "bankDraw":
				fly(event.card, "stock", "bank");
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
