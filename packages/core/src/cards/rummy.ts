/**
 * Rummy family: draw, lay down sets and runs, discard, go out first. Penalty
 * points for what stays in a hand decide a match over several rounds. What
 * differs between games in the family (Jokeren, Rummy 500) is `RummyRules` data.
 */
import { GameRuleError } from "../errors";
import {
	buildDeck,
	type CardId,
	clone,
	deal,
	drawCards,
	isJoker,
	parseCard,
	RANKS,
	type Random,
	type Rank,
	removeCard,
	shuffle,
} from "./deck";
import { type CardEvent, pushEvent } from "./events";
import {
	buildMeld,
	extendMeld,
	handPoints,
	type Meld,
	type MeldRules,
	type MeldShape,
	meldPoints,
	swapJoker,
} from "./melds";
import type { BotMove } from "./shedding";

export type RummyRules = MeldRules & {
	decks: number;
	jokers: number;
	handSize: number;
	/** Points a player's first lay-down must reach in one turn. */
	openingPoints: number;
	/** The top of the discard pile may be drawn instead of the stock. */
	takeFromDiscard: boolean;
	/** Rounds in a match; lowest penalty total wins. */
	rounds: number;
	/** Turns before a stalled round is called off and scored as it stands. */
	maxTurnsPerRound: number;
};

export type RummyState = {
	family: "rummy";
	hands: CardId[][];
	stock: CardId[];
	discard: CardId[];
	melds: Meld[];
	nextMeldId: number;
	opened: boolean[];
	turn: number;
	dealer: number;
	phase: "draw" | "play" | "roundOver" | "finished";
	round: number;
	/** Penalty points per finished round, one entry per seat. */
	scores: number[][];
	/** Taken from the discard pile this turn: may not go straight back. */
	takenDiscard: CardId | null;
	turnsPlayed: number;
	roundWinner: number | null;
	winners: number[];
	events: CardEvent[];
	nextSeq: number;
};

type RummyLayDown = {
	melds?: CardId[][];
	additions?: Array<{ meldId: number; cards: CardId[] }>;
	swaps?: Array<{ meldId: number; card: CardId }>;
};

export type RummyAction =
	| { type: "drawStock" }
	| { type: "takeDiscard" }
	| ({ type: "layDown" } & RummyLayDown)
	| { type: "discard"; card: CardId }
	| { type: "nextRound" };

export type RummyView = {
	family: "rummy";
	phase: RummyState["phase"];
	turn: number;
	round: number;
	totalRounds: number;
	top: CardId | null;
	underTop: CardId[];
	stockCount: number;
	melds: Meld[];
	opened: boolean[];
	handCounts: number[];
	hand: CardId[];
	takenDiscard: CardId | null;
	scores: number[][];
	totals: number[];
	roundWinner: number | null;
	/** Everyone's hand, only once the round is over. */
	revealed: CardId[][] | null;
	winners: number[];
	events: CardEvent[];
};

export function createRummy(
	rules: RummyRules,
	seats: number,
	random: Random,
	dealer = seats - 1,
	carried?: Pick<RummyState, "round" | "scores" | "nextSeq" | "events">,
): RummyState {
	const stock = shuffle(buildDeck(rules.decks, rules.jokers), random);
	const hands = deal(stock, seats, rules.handSize);
	const state: RummyState = {
		family: "rummy",
		hands,
		stock,
		discard: [stock.pop() as CardId],
		melds: [],
		nextMeldId: 1,
		opened: hands.map(() => false),
		turn: (dealer + 1) % seats,
		dealer,
		phase: "draw",
		round: carried?.round ?? 1,
		scores: carried?.scores ?? [],
		takenDiscard: null,
		turnsPlayed: 0,
		roundWinner: null,
		winners: [],
		events: carried?.events ?? [],
		nextSeq: carried?.nextSeq ?? 0,
	};
	pushEvent(state, { type: "deal", round: state.round });
	return state;
}

function totalsOf(scores: readonly number[][], seats: number) {
	return Array.from({ length: seats }, (_, seat) =>
		scores.reduce((sum, round) => sum + (round[seat] ?? 0), 0),
	);
}

function endRound(rules: RummyRules, state: RummyState, winner: number | null) {
	const round = state.hands.map((hand) => handPoints(hand, rules));
	state.scores.push(round);
	state.roundWinner = winner;
	pushEvent(state, { type: "roundEnd", winner, round: state.round });
	if (state.round >= rules.rounds) {
		state.phase = "finished";
		const totals = totalsOf(state.scores, state.hands.length);
		const lowest = Math.min(...totals);
		state.winners = totals.flatMap((total, seat) =>
			total === lowest ? [seat] : [],
		);
		pushEvent(state, { type: "win", seats: state.winners });
		return;
	}
	state.phase = "roundOver";
}

function requireTurn(state: RummyState, seat: number, phase: "draw" | "play") {
	if (state.phase === "roundOver" || state.phase === "finished") {
		throw new GameRuleError("noActiveRound");
	}
	if (state.turn !== seat) {
		throw new GameRuleError("notYourTurn");
	}
	if (state.phase !== phase) {
		throw new GameRuleError(
			phase === "draw" ? "cardsAlreadyDrew" : "cardsDrawFirst",
		);
	}
}

function applyLayDown(
	rules: RummyRules,
	state: RummyState,
	seat: number,
	action: RummyLayDown,
) {
	const hand = state.hands[seat];
	const newMelds = action.melds ?? [];
	const additions = action.additions ?? [];
	const swaps = action.swaps ?? [];
	if (newMelds.length + additions.length + swaps.length === 0) {
		throw new GameRuleError("cardsNothingToLay");
	}
	const take = (card: CardId) => {
		if (!removeCard(hand, card)) {
			throw new GameRuleError("cardsNotInHand");
		}
	};

	const built: MeldShape[] = [];
	for (const cards of newMelds) {
		const shape = buildMeld(cards, rules);
		if (!shape) {
			throw new GameRuleError("cardsInvalidMeld");
		}
		for (const card of cards) {
			take(card);
		}
		built.push(shape);
	}
	if (!state.opened[seat]) {
		const points = built.reduce(
			(sum, shape) => sum + meldPoints(shape, rules),
			0,
		);
		if (points < rules.openingPoints) {
			throw new GameRuleError("cardsOpeningTooLow", {
				needed: rules.openingPoints,
				have: points,
			});
		}
	}
	const meldIds: number[] = [];
	for (const shape of built) {
		const id = state.nextMeldId;
		state.nextMeldId += 1;
		state.melds.push({ ...shape, id } as Meld);
		meldIds.push(id);
	}
	if (built.length > 0) {
		pushEvent(state, {
			type: "meld",
			seat,
			meldIds,
			opened: !state.opened[seat],
		});
		state.opened[seat] = true;
	}

	const meldAt = (meldId: number) => {
		const index = state.melds.findIndex((meld) => meld.id === meldId);
		if (index < 0) {
			throw new GameRuleError("cardsInvalidMeld");
		}
		return index;
	};
	// Swaps come first so a freed joker can be used by the additions.
	for (const swap of swaps) {
		const index = meldAt(swap.meldId);
		const swapped = swapJoker(state.melds[index], swap.card);
		if (!swapped) {
			throw new GameRuleError("cardsCannotSwap");
		}
		take(swap.card);
		state.melds[index] = swapped.meld;
		hand.push(swapped.joker);
		pushEvent(state, {
			type: "swap",
			seat,
			meldId: swap.meldId,
			card: swap.card,
		});
	}
	for (const addition of additions) {
		const index = meldAt(addition.meldId);
		for (const card of addition.cards) {
			const extended = extendMeld(state.melds[index], card);
			if (!extended) {
				throw new GameRuleError("cardsDoesNotExtend");
			}
			take(card);
			state.melds[index] = extended;
		}
		pushEvent(state, {
			type: "layoff",
			seat,
			meldId: addition.meldId,
			cards: addition.cards,
		});
	}
	if (hand.length === 0) {
		throw new GameRuleError("cardsKeepOneToDiscard");
	}
	// Going out takes a last discard, so holding only one card is the same thing.
	if (hand.length === 1 && state.turnsPlayed < state.hands.length - 1) {
		throw new GameRuleError("cardsEveryoneGetsATurn");
	}
}

export function applyRummy(
	rules: RummyRules,
	previous: RummyState,
	seat: number,
	action: RummyAction,
	random: Random,
): RummyState {
	const state = clone(previous);
	switch (action.type) {
		case "nextRound": {
			if (state.phase !== "roundOver") {
				throw new GameRuleError("currentGameNotFinished");
			}
			return createRummy(
				rules,
				state.hands.length,
				random,
				(state.dealer + 1) % state.hands.length,
				{
					round: state.round + 1,
					scores: state.scores,
					nextSeq: state.nextSeq,
					events: state.events,
				},
			);
		}
		case "drawStock": {
			requireTurn(state, seat, "draw");
			const { drawn, reshuffled } = drawCards(state, 1, random);
			if (reshuffled) {
				pushEvent(state, { type: "reshuffle" });
			}
			if (drawn.length === 0) {
				endRound(rules, state, null);
				return state;
			}
			state.hands[seat].push(drawn[0]);
			state.phase = "play";
			pushEvent(state, { type: "draw", seat, count: 1, source: "stock" });
			return state;
		}
		case "takeDiscard": {
			requireTurn(state, seat, "draw");
			if (!rules.takeFromDiscard) {
				throw new GameRuleError("cardsStockOnly");
			}
			const card = state.discard.pop();
			if (!card) {
				throw new GameRuleError("cardsDiscardEmpty");
			}
			state.hands[seat].push(card);
			state.takenDiscard = card;
			state.phase = "play";
			pushEvent(state, { type: "draw", seat, count: 1, source: "discard" });
			return state;
		}
		case "layDown": {
			requireTurn(state, seat, "play");
			applyLayDown(rules, state, seat, action);
			return state;
		}
		case "discard": {
			requireTurn(state, seat, "play");
			const hand = state.hands[seat];
			if (!hand.includes(action.card)) {
				throw new GameRuleError("cardsNotInHand");
			}
			if (action.card === state.takenDiscard && hand.length > 1) {
				throw new GameRuleError("cardsCannotReturnDiscard");
			}
			removeCard(hand, action.card);
			state.discard.push(action.card);
			state.takenDiscard = null;
			pushEvent(state, { type: "discard", seat, card: action.card });
			if (hand.length === 0) {
				endRound(rules, state, seat);
				return state;
			}
			state.turnsPlayed += 1;
			if (state.turnsPlayed >= rules.maxTurnsPerRound) {
				endRound(rules, state, null);
				return state;
			}
			state.turn = (state.turn + 1) % state.hands.length;
			state.phase = "draw";
			return state;
		}
	}
}

export function viewRummy(
	rules: RummyRules,
	state: RummyState,
	seat: number | null,
): RummyView {
	const ended = state.phase === "roundOver" || state.phase === "finished";
	const isTurn = seat !== null && state.turn === seat && !ended;
	return {
		family: "rummy",
		phase: state.phase,
		turn: state.turn,
		round: state.round,
		totalRounds: rules.rounds,
		top: state.discard[state.discard.length - 1] ?? null,
		underTop: state.discard.slice(-4, -1),
		stockCount: state.stock.length,
		melds: state.melds,
		opened: state.opened,
		handCounts: state.hands.map((hand) => hand.length),
		hand: seat === null ? [] : state.hands[seat],
		takenDiscard: isTurn ? state.takenDiscard : null,
		scores: state.scores,
		totals: totalsOf(state.scores, state.hands.length),
		roundWinner: state.roundWinner,
		revealed: ended ? state.hands : null,
		winners: state.winners,
		events: state.events,
	};
}

// --- Computer player -------------------------------------------------------

/** Every meld findable in `hand`, best first. Jokers fill single gaps only. */
function candidateMelds(hand: readonly CardId[], rules: RummyRules) {
	const naturals = hand.filter((card) => !isJoker(card));
	const jokers = hand.filter(isJoker);
	const found: MeldShape[] = [];
	const unique = (cards: CardId[]) => {
		const faces = new Set<string>();
		return cards.filter((card) => {
			const face = card.split("#")[0];
			if (faces.has(face)) {
				return false;
			}
			faces.add(face);
			return true;
		});
	};
	const groups = new Map<string, CardId[]>();
	for (const card of unique(naturals)) {
		const face = card.split("#")[0];
		const rank = face.slice(1);
		groups.set(`r${rank}`, [...(groups.get(`r${rank}`) ?? []), card]);
		groups.set(`s${face[0]}`, [...(groups.get(`s${face[0]}`) ?? []), card]);
	}
	// Only naturals are grouped, so every card here has a rank.
	const rankOf = (card: CardId) => parseCard(card).rank as Rank;
	for (const [key, group] of groups) {
		// Runs are looked for in windows, so a suit has to be in rank order.
		const cards = [...group].sort(
			(a, b) => RANKS.indexOf(rankOf(a)) - RANKS.indexOf(rankOf(b)),
		);
		if (key.startsWith("r")) {
			for (const shape of [
				buildMeld(cards.slice(0, 4), rules),
				cards.length === 2 && jokers[0]
					? buildMeld([...cards, jokers[0]], rules)
					: null,
			]) {
				if (shape) {
					found.push(shape);
				}
			}
			continue;
		}
		// Every contiguous window of the suit, with at most one joker in it.
		for (let start = 0; start < cards.length; start += 1) {
			for (let end = start + 1; end < cards.length; end += 1) {
				const window = cards.slice(start, end + 1);
				const plain = buildMeld(window, rules);
				if (plain) {
					found.push(plain);
				}
				if (jokers[0]) {
					const assisted = buildMeld([...window, jokers[0]], rules);
					if (assisted) {
						found.push(assisted);
					}
				}
			}
		}
	}
	return found.sort((a, b) => meldPoints(b, rules) - meldPoints(a, rules));
}

/** Greedy non-overlapping melds, never spending the last card in hand. */
export function findMelds(hand: readonly CardId[], rules: RummyRules) {
	const remaining = [...hand];
	const chosen: MeldShape[] = [];
	for (const shape of candidateMelds(hand, rules)) {
		const free = shape.cards.every((card) => remaining.includes(card));
		if (free && remaining.length - shape.cards.length >= 1) {
			for (const card of shape.cards) {
				removeCard(remaining, card);
			}
			chosen.push(shape);
		}
	}
	return chosen;
}

/** Bots keep their cards for this many rounds of turns, so nobody is rushed out. */
const BOT_PATIENCE_ROUNDS = 3;

/** Whether `seat` already put cards on the table since its latest draw. */
function hasLaidThisTurn(state: RummyState, seat: number) {
	for (let index = state.events.length - 1; index >= 0; index -= 1) {
		const event = state.events[index];
		if (event.type === "draw" && event.seat === seat) {
			return false;
		}
		if (
			(event.type === "meld" ||
				event.type === "layoff" ||
				event.type === "swap") &&
			event.seat === seat
		) {
			return true;
		}
	}
	return false;
}

/**
 * The best melds to put down now. Opening takes only as many as the opening
 * asks; after that, one a turn. People pace themselves too, and it leaves the
 * others time to play.
 */
function meldsToLay(rules: RummyRules, state: RummyState, seat: number) {
	const melds = findMelds(state.hands[seat], rules);
	if (state.opened[seat]) {
		return melds.slice(0, 1);
	}
	const points = melds.reduce(
		(sum, shape) => sum + meldPoints(shape, rules),
		0,
	);
	const patient = state.turnsPlayed < state.hands.length * BOT_PATIENCE_ROUNDS;
	if (patient || points < rules.openingPoints) {
		return [];
	}
	const opening: MeldShape[] = [];
	let total = 0;
	for (const shape of melds) {
		if (total >= rules.openingPoints) {
			break;
		}
		opening.push(shape);
		total += meldPoints(shape, rules);
	}
	return opening;
}

/** At most one lay-down a turn: new melds, joker swaps and one added card. */
function botLayDown(
	rules: RummyRules,
	state: RummyState,
	seat: number,
): RummyLayDown | null {
	if (hasLaidThisTurn(state, seat)) {
		return null;
	}
	const opened = state.opened[seat];
	const laying = meldsToLay(rules, state, seat);
	const remaining = [...state.hands[seat]];
	for (const shape of laying) {
		for (const card of shape.cards) {
			removeCard(remaining, card);
		}
	}
	const swaps: Array<{ meldId: number; card: CardId }> = [];
	const additions: Array<{ meldId: number; cards: CardId[] }> = [];
	if (opened) {
		const table = state.melds.map((meld) => ({ ...meld }) as Meld);
		// Planned in the order applyLayDown runs them: every swap, then the addition.
		for (let index = 0; index < table.length; index += 1) {
			for (const card of [...remaining]) {
				const swapped = swapJoker(table[index], card);
				if (swapped && remaining.length > 1) {
					swaps.push({ meldId: table[index].id, card });
					table[index] = swapped.meld;
					removeCard(remaining, card);
				}
			}
		}
		for (let index = 0; index < table.length && !additions.length; index += 1) {
			const card = remaining.find((held) => extendMeld(table[index], held));
			if (card && remaining.length > 1) {
				additions.push({ meldId: table[index].id, cards: [card] });
			}
		}
	}
	const newMelds = laying.map((shape) => shape.cards);
	if (newMelds.length + additions.length + swaps.length === 0) {
		return null;
	}
	// Autopilot can take over a human who opened early: it must stay legal too.
	const held = remaining.length + swaps.length - additions.length;
	if (held === 1 && state.turnsPlayed < state.hands.length - 1) {
		return null;
	}
	return { melds: newMelds, additions, swaps };
}

function botDiscard(rules: RummyRules, state: RummyState, seat: number) {
	const hand = state.hands[seat];
	const allowed = hand.filter(
		(card) => card !== state.takenDiscard || hand.length === 1,
	);
	const naturals = allowed.filter((card) => !isJoker(card));
	const pool = naturals.length > 0 ? naturals : allowed;
	const neighbours = (card: CardId) => {
		const face = card.split("#")[0];
		return hand.filter((other) => {
			if (other === card || isJoker(other)) {
				return false;
			}
			const otherFace = other.split("#")[0];
			return (
				otherFace.slice(1) === face.slice(1) ||
				(otherFace[0] === face[0] &&
					Math.abs(rankOfFace(otherFace) - rankOfFace(face)) <= 2)
			);
		}).length;
	};
	return [...pool].sort(
		(a, b) =>
			neighbours(a) - neighbours(b) ||
			handPoints([b], rules) - handPoints([a], rules),
	)[0];
}

function rankOfFace(face: string) {
	return RANKS.indexOf(face.slice(1) as Rank);
}

function discardHelps(rules: RummyRules, state: RummyState, seat: number) {
	const top = state.discard[state.discard.length - 1];
	if (!top || !rules.takeFromDiscard) {
		return false;
	}
	const hand = state.hands[seat];
	const before = findMelds(hand, rules);
	const after = findMelds([...hand, top], rules);
	const score = (melds: MeldShape[]) =>
		melds.reduce((sum, shape) => sum + meldPoints(shape, rules), 0);
	const usable = state.opened[seat] || score(after) >= rules.openingPoints;
	return (
		usable &&
		!isJoker(top) &&
		(score(after) > score(before) ||
			(state.opened[seat] &&
				state.melds.some((meld) => extendMeld(meld, top) !== null)))
	);
}

export function botRummyMove(
	rules: RummyRules,
	state: RummyState,
	bots: readonly number[],
): BotMove<RummyAction> | null {
	if (state.phase === "roundOver") {
		// Humans start the next round, unless all of them are on autopilot.
		return bots.length === state.hands.length
			? { seat: bots[0], action: { type: "nextRound" }, pace: "reaction" }
			: null;
	}
	if (state.phase === "finished" || !bots.includes(state.turn)) {
		return null;
	}
	const seat = state.turn;
	if (state.phase === "draw") {
		return {
			seat,
			action: discardHelps(rules, state, seat)
				? { type: "takeDiscard" }
				: { type: "drawStock" },
			pace: "turn",
		};
	}
	const layDown = botLayDown(rules, state, seat);
	if (layDown) {
		return { seat, action: { type: "layDown", ...layDown }, pace: "followUp" };
	}
	return {
		seat,
		action: { type: "discard", card: botDiscard(rules, state, seat) },
		pace: "followUp",
	};
}
