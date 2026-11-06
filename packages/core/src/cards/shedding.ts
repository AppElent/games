/**
 * Shedding family: match the top card, weaponise special cards, empty your
 * hand first. Everything that differs between games in this family (Pesten,
 * Mau-Mau, Crazy Eights) is `SheddingRules` data.
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
	type Random,
	type Rank,
	removeCard,
	SUITS,
	type Suit,
	shuffle,
} from "./deck";
import { type CardEvent, pushEvent } from "./events";

export type CardPower =
	/** Next player draws `amount` unless they can stack. */
	| { kind: "draw"; amount: number; wild?: boolean }
	/** Next player misses their turn. */
	| { kind: "skip" }
	/** Play direction flips. */
	| { kind: "reverse" }
	/** Same player goes again. */
	| { kind: "again" }
	/** Playable on anything; the player names the next suit. */
	| { kind: "chooseSuit" };

export type PowerKey = Rank | "joker";

export type SheddingRules = {
	/** First matching entry from the top wins: `from` is a minimum seat count. */
	decks: ReadonlyArray<{ from: number; decks: number }>;
	jokersPerDeck: number;
	handSize: number;
	powers: Partial<Record<PowerKey, CardPower>>;
	/** A draw card may answer a draw card, passing on the total. */
	stackDraws: boolean;
	/** A card drawn by choice or need may be played at once when it fits. */
	playDrawnCard: boolean;
	/** Draw even when a card could be played. */
	voluntaryDraw: boolean;
	/** Cards for failing to call a last card; null turns calling off. */
	lastCardPenalty: number | null;
	/** Cards for going out on a power card (not out then); null allows it. */
	finishOnPowerPenalty: number | null;
	/** With two players a reverse would do nothing: optionally an extra turn. */
	twoPlayerReverseAgain: boolean;
};

export type SheddingState = {
	family: "shedding";
	hands: CardId[][];
	stock: CardId[];
	discard: CardId[];
	turn: number;
	/** Who led this game; the rematch passes the lead on. */
	starter: number;
	direction: 1 | -1;
	/** Named by a suit-choosing card; overrides the top card's suit. */
	activeSuit: Suit | null;
	/** Top card accepts anything (a wild that names no suit). */
	openTable: boolean;
	pendingDraw: number;
	/** Current player must play again before the turn moves on. */
	mustContinue: boolean;
	/** Current player just drew this and may only play it or pass. */
	drawnCard: CardId | null;
	/** Seat that went to one card without calling it. */
	lastCardDebtor: number | null;
	phase: "playing" | "finished";
	winners: number[];
	events: CardEvent[];
	nextSeq: number;
};

export type SheddingAction =
	| { type: "play"; card: CardId; suit?: Suit; callLast?: boolean }
	| { type: "draw" }
	| { type: "pass" }
	| { type: "callLast" }
	| { type: "catch"; target: number };

export type SheddingView = {
	family: "shedding";
	phase: SheddingState["phase"];
	turn: number;
	direction: 1 | -1;
	top: CardId;
	/** Up to three cards under the top one, for a believable pile. */
	underTop: CardId[];
	stockCount: number;
	activeSuit: Suit | null;
	openTable: boolean;
	pendingDraw: number;
	mustContinue: boolean;
	handCounts: number[];
	hand: CardId[];
	legal: CardId[];
	drawnCard: CardId | null;
	canDraw: boolean;
	canPass: boolean;
	canCallLast: boolean;
	lastCardDebtor: number | null;
	winners: number[];
	events: CardEvent[];
};

export function powerOf(rules: SheddingRules, card: CardId) {
	const parsed = parseCard(card);
	return rules.powers[parsed.joker ? "joker" : parsed.rank];
}

function isWild(power: CardPower | undefined) {
	return power?.kind === "chooseSuit" || (power?.kind === "draw" && power.wild);
}

export function canPlaySheddingCard(
	rules: SheddingRules,
	state: SheddingState,
	card: CardId,
) {
	const power = powerOf(rules, card);
	if (state.pendingDraw > 0) {
		return rules.stackDraws && power?.kind === "draw";
	}
	if (isWild(power) || state.openTable) {
		return true;
	}
	const parsed = parseCard(card);
	if (parsed.joker) {
		return false;
	}
	const top = parseCard(state.discard[state.discard.length - 1]);
	if (state.activeSuit) {
		return parsed.suit === state.activeSuit;
	}
	if (top.joker) {
		return true;
	}
	return parsed.suit === top.suit || parsed.rank === top.rank;
}

function legalCards(rules: SheddingRules, state: SheddingState, seat: number) {
	if (state.phase !== "playing" || state.turn !== seat) {
		return [];
	}
	const candidates = state.drawnCard ? [state.drawnCard] : state.hands[seat];
	return candidates.filter((card) => canPlaySheddingCard(rules, state, card));
}

function nextSeat(state: SheddingState, steps = 1) {
	const count = state.hands.length;
	return (
		(state.turn + state.direction * steps + count * Math.abs(steps)) % count
	);
}

function moveTurn(state: SheddingState, steps = 1) {
	state.turn = nextSeat(state, steps);
	state.mustContinue = false;
	state.drawnCard = null;
}

function draw(
	state: SheddingState,
	seat: number,
	count: number,
	random: Random,
) {
	const { drawn, reshuffled } = drawCards(state, count, random);
	if (reshuffled) {
		pushEvent(state, { type: "reshuffle" });
	}
	state.hands[seat].push(...drawn);
	return drawn;
}

function finish(state: SheddingState, winners: number[]) {
	state.phase = "finished";
	state.winners = winners;
	state.mustContinue = false;
	state.drawnCard = null;
	state.lastCardDebtor = null;
	pushEvent(state, { type: "win", seats: winners });
}

/** Nobody can move and nothing is left to draw: fewest cards wins. */
function finishIfDeadlocked(rules: SheddingRules, state: SheddingState) {
	if (state.stock.length > 0 || state.discard.length > 1) {
		return;
	}
	const anyoneCanPlay = state.hands.some((hand) =>
		hand.some((card) => canPlaySheddingCard(rules, state, card)),
	);
	if (anyoneCanPlay) {
		return;
	}
	const fewest = Math.min(...state.hands.map((hand) => hand.length));
	finish(
		state,
		state.hands.flatMap((hand, seat) => (hand.length === fewest ? [seat] : [])),
	);
}

export function createShedding(
	rules: SheddingRules,
	seats: number,
	random: Random,
	starter = 0,
): SheddingState {
	const decks = rules.decks.find((entry) => seats >= entry.from)?.decks ?? 1;
	const stock = shuffle(buildDeck(decks, decks * rules.jokersPerDeck), random);
	const hands = deal(stock, seats, rules.handSize);
	// The first card never carries a power: reshuffle it into the stock.
	let top = stock.pop() as CardId;
	while (powerOf(rules, top)) {
		stock.unshift(top);
		top = stock.pop() as CardId;
	}
	const state: SheddingState = {
		family: "shedding",
		hands,
		stock,
		discard: [top],
		turn: starter,
		starter,
		direction: 1,
		activeSuit: null,
		openTable: false,
		pendingDraw: 0,
		mustContinue: false,
		drawnCard: null,
		lastCardDebtor: null,
		phase: "playing",
		winners: [],
		events: [],
		nextSeq: 0,
	};
	pushEvent(state, { type: "deal", round: 1 });
	return state;
}

function applyPlay(
	rules: SheddingRules,
	state: SheddingState,
	seat: number,
	action: Extract<SheddingAction, { type: "play" }>,
	random: Random,
) {
	if (state.drawnCard && action.card !== state.drawnCard) {
		throw new GameRuleError("cardsOnlyDrawnCard");
	}
	if (!state.hands[seat].includes(action.card)) {
		throw new GameRuleError("cardsNotInHand");
	}
	if (!canPlaySheddingCard(rules, state, action.card)) {
		throw new GameRuleError(
			state.pendingDraw > 0 ? "cardsMustAnswerDraw" : "cardsDoesNotFit",
		);
	}
	const power = powerOf(rules, action.card);
	if (power?.kind === "chooseSuit") {
		if (!action.suit || !SUITS.includes(action.suit)) {
			throw new GameRuleError("cardsChooseSuit");
		}
	}
	removeCard(state.hands[seat], action.card);
	state.discard.push(action.card);
	state.activeSuit =
		power?.kind === "chooseSuit" ? (action.suit ?? null) : null;
	state.openTable = power?.kind === "draw" && Boolean(power.wild);
	state.mustContinue = false;
	state.drawnCard = null;
	pushEvent(state, {
		type: "play",
		seat,
		card: action.card,
		...(power?.kind === "chooseSuit" ? { suit: action.suit } : {}),
	});

	const hand = state.hands[seat];
	if (hand.length === 0) {
		if (power && rules.finishOnPowerPenalty !== null) {
			const drawn = draw(state, seat, rules.finishOnPowerPenalty, random);
			state.lastCardDebtor = null;
			pushEvent(state, {
				type: "finishPenalty",
				seat,
				count: drawn.length,
			});
		} else {
			finish(state, [seat]);
			return;
		}
	}
	if (hand.length === 1 && rules.lastCardPenalty !== null) {
		if (action.callLast) {
			pushEvent(state, { type: "lastCard", seat });
		} else {
			state.lastCardDebtor = seat;
		}
	}

	switch (power?.kind) {
		case "draw":
			state.pendingDraw += power.amount;
			moveTurn(state);
			break;
		case "skip":
			pushEvent(state, { type: "skip", seat: nextSeat(state) });
			moveTurn(state, 2);
			break;
		case "reverse":
			state.direction = state.direction === 1 ? -1 : 1;
			pushEvent(state, { type: "reverse", direction: state.direction });
			if (state.hands.length === 2 && rules.twoPlayerReverseAgain) {
				state.mustContinue = true;
				pushEvent(state, { type: "again", seat });
			} else {
				moveTurn(state);
			}
			break;
		case "again":
			state.mustContinue = true;
			pushEvent(state, { type: "again", seat });
			break;
		default:
			moveTurn(state);
	}
}

function applyDraw(
	rules: SheddingRules,
	state: SheddingState,
	seat: number,
	random: Random,
) {
	if (state.drawnCard) {
		throw new GameRuleError("cardsAlreadyDrew");
	}
	if (state.pendingDraw > 0) {
		const drawn = draw(state, seat, state.pendingDraw, random);
		state.pendingDraw = 0;
		pushEvent(state, {
			type: "penalty",
			seat,
			count: drawn.length,
		});
		moveTurn(state);
		finishIfDeadlocked(rules, state);
		return;
	}
	if (
		!rules.voluntaryDraw &&
		state.hands[seat].some((card) => canPlaySheddingCard(rules, state, card))
	) {
		throw new GameRuleError("cardsMustPlay");
	}
	const [card] = draw(state, seat, 1, random);
	if (card) {
		pushEvent(state, { type: "draw", seat, count: 1, source: "stock" });
	}
	if (card && rules.playDrawnCard && canPlaySheddingCard(rules, state, card)) {
		state.drawnCard = card;
		return;
	}
	moveTurn(state);
	finishIfDeadlocked(rules, state);
}

export function applyShedding(
	rules: SheddingRules,
	previous: SheddingState,
	seat: number,
	action: SheddingAction,
	random: Random,
): SheddingState {
	const state = clone(previous);
	if (state.phase !== "playing") {
		throw new GameRuleError("gameAlreadyFinished");
	}
	if (action.type === "callLast") {
		if (state.lastCardDebtor !== seat) {
			throw new GameRuleError("cardsNothingToCall");
		}
		state.lastCardDebtor = null;
		pushEvent(state, { type: "lastCard", seat });
		return state;
	}
	if (action.type === "catch") {
		if (state.lastCardDebtor !== action.target || action.target === seat) {
			throw new GameRuleError("cardsNothingToCatch");
		}
		state.lastCardDebtor = null;
		const drawn = draw(
			state,
			action.target,
			rules.lastCardPenalty ?? 0,
			random,
		);
		pushEvent(state, {
			type: "caught",
			seat: action.target,
			by: seat,
			count: drawn.length,
		});
		return state;
	}
	if (state.turn !== seat) {
		throw new GameRuleError("notYourTurn");
	}
	// Acting closes the window to catch the previous player.
	if (state.lastCardDebtor !== seat) {
		state.lastCardDebtor = null;
	}
	switch (action.type) {
		case "play":
			applyPlay(rules, state, seat, action, random);
			break;
		case "draw":
			// Holding more than one card again, so there is no last card to call.
			state.lastCardDebtor = null;
			applyDraw(rules, state, seat, random);
			break;
		case "pass":
			if (!state.drawnCard) {
				throw new GameRuleError("cardsCannotPass");
			}
			pushEvent(state, { type: "pass", seat });
			moveTurn(state);
			break;
	}
	return state;
}

export function viewShedding(
	rules: SheddingRules,
	state: SheddingState,
	seat: number | null,
): SheddingView {
	const isTurn =
		seat !== null && state.phase === "playing" && state.turn === seat;
	const hand = seat === null ? [] : state.hands[seat];
	const legal = seat === null ? [] : legalCards(rules, state, seat);
	return {
		family: "shedding",
		phase: state.phase,
		turn: state.turn,
		direction: state.direction,
		top: state.discard[state.discard.length - 1],
		underTop: state.discard.slice(-4, -1),
		stockCount: state.stock.length,
		activeSuit: state.activeSuit,
		openTable: state.openTable,
		pendingDraw: state.pendingDraw,
		mustContinue: state.mustContinue,
		handCounts: state.hands.map((cards) => cards.length),
		hand,
		legal,
		drawnCard: isTurn ? state.drawnCard : null,
		canDraw:
			isTurn &&
			!state.drawnCard &&
			(rules.voluntaryDraw || state.pendingDraw > 0 || legal.length === 0),
		canPass: isTurn && state.drawnCard !== null,
		canCallLast: seat !== null && state.lastCardDebtor === seat,
		lastCardDebtor: state.lastCardDebtor,
		winners: state.winners,
		events: state.events,
	};
}

export type BotMove<Action> = {
	seat: number;
	action: Action;
	/** A new turn, the rest of a turn already under way, or a reply to someone else. */
	pace: "turn" | "followUp" | "reaction";
};

function chooseSuitFor(hand: CardId[], excluding: CardId): Suit {
	const counts = new Map<Suit, number>();
	for (const card of hand) {
		const parsed = parseCard(card);
		if (card !== excluding && !parsed.joker) {
			counts.set(parsed.suit, (counts.get(parsed.suit) ?? 0) + 1);
		}
	}
	return [...SUITS].sort(
		(a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0),
	)[0];
}

/** Saves wilds; spends attacks when someone is close to going out. */
function scorePlay(rules: SheddingRules, state: SheddingState, card: CardId) {
	const power = powerOf(rules, card);
	const threat = state.hands.some((hand) => hand.length <= 2);
	if (!power) {
		return 5;
	}
	if (power.kind === "chooseSuit") {
		return state.hands[state.turn].length <= 2 ? 3 : 0;
	}
	if (power.kind === "draw") {
		return threat || isJoker(card) === false ? 6 : 1;
	}
	return threat ? 7 : 4;
}

export function botSheddingMove(
	rules: SheddingRules,
	state: SheddingState,
	bots: readonly number[],
	random: Random,
): BotMove<SheddingAction> | null {
	if (state.phase !== "playing") {
		return null;
	}
	if (state.lastCardDebtor !== null) {
		const debtor = state.lastCardDebtor;
		if (bots.includes(debtor)) {
			return {
				seat: debtor,
				action: { type: "callLast" },
				pace: "reaction",
			};
		}
		const catcher = bots.find((seat) => seat !== debtor);
		if (catcher !== undefined) {
			return {
				seat: catcher,
				action: { type: "catch", target: debtor },
				pace: "reaction",
			};
		}
	}
	const seat = state.turn;
	if (!bots.includes(seat)) {
		return null;
	}
	const legal = legalCards(rules, state, seat);
	if (legal.length === 0) {
		return {
			seat,
			action: state.drawnCard ? { type: "pass" } : { type: "draw" },
			pace: "turn",
		};
	}
	const best = [...legal].sort(
		(a, b) =>
			scorePlay(rules, state, b) - scorePlay(rules, state, a) || random() - 0.5,
	)[0];
	const power = powerOf(rules, best);
	return {
		seat,
		action: {
			type: "play",
			card: best,
			...(power?.kind === "chooseSuit"
				? { suit: chooseSuitFor(state.hands[seat], best) }
				: {}),
			// Bots forget one last card in six, so catching them is possible.
			callLast: random() > 1 / 6,
		},
		pace: "turn",
	};
}
