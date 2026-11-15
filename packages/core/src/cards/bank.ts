/**
 * Bank family: every player against a computer bank that is part of the game,
 * not a seat. Each round players pick how many points a hand is worth, take
 * cards towards 21 without going over, and then the bank plays by fixed rules.
 * Points only: what differs between games (Eenentwintigen) is `BankRules` data.
 */
import { GameRuleError } from "../errors";
import { type Rng, shuffle } from "../random";
import { buildDeck, type CardId, clone, parseCard } from "./deck";
import { type CardEvent, pushEvent } from "./events";
import { type BotMove, drawWithReshuffle } from "./table";

export type BankRules = {
	decks: number;
	/** The points a hand may be played for; a player picks one each round. */
	stakes: readonly number[];
	/** Rounds in a match; the highest total wins. */
	rounds: number;
	/** The bank draws until its total reaches this. */
	bankStandsOn: number;
	/** The bank also draws on a soft total equal to `bankStandsOn`. */
	bankHitsSoft: boolean;
	/** On two cards, a player may double the points, take one card and stop. */
	doubleDown: boolean;
	/** 21 in two cards wins this many times the points, rounded. */
	naturalPays: number;
};

export type BankState = {
	family: "bank";
	/** Each player's cards; every player's cards are dealt face up. */
	hands: CardId[][];
	/** The bank's cards; the second stays face down until the bank plays. */
	bank: CardId[];
	stock: CardId[];
	/** Cards from earlier rounds, shuffled back in when the stock runs low. */
	discard: CardId[];
	/** Points each seat plays this round for; null until they choose. */
	stakes: (number | null)[];
	/** Seats whose hand is over this round: stood, bust, doubled or 21. */
	done: boolean[];
	turn: number;
	/** Who plays first in round one; the rematch passes it on. */
	starter: number;
	phase: "stake" | "play" | "finished";
	round: number;
	/** The bank has shown its face-down card. */
	bankRevealed: boolean;
	/** Points won or lost per finished round, one entry per seat. */
	results: number[][];
	winners: number[];
	events: CardEvent[];
	nextSeq: number;
};

export type BankAction =
	| { type: "stake"; amount: number }
	| { type: "hit" }
	| { type: "stand" }
	| { type: "double" };

/** Keyed by action type, so a new action cannot be left out. */
export const BANK_ACTIONS: Record<BankAction["type"], true> = {
	stake: true,
	hit: true,
	stand: true,
	double: true,
};

export type BankView = {
	family: "bank";
	phase: BankState["phase"];
	turn: number;
	round: number;
	totalRounds: number;
	hands: CardId[][];
	/** Everyone's hand total, so nobody has to count. */
	handTotals: number[];
	handCounts: number[];
	/** The bank's cards, with the face-down one as null. */
	bank: (CardId | null)[];
	/** The total of the bank's visible cards. */
	bankTotal: number;
	stockCount: number;
	stakes: (number | null)[];
	results: number[][];
	totals: number[];
	stakeOptions: readonly number[];
	canStake: boolean;
	canDouble: boolean;
	winners: number[];
	events: CardEvent[];
};

const TARGET = 21;

function cardValue(card: CardId) {
	const parsed = parseCard(card);
	if (parsed.joker) {
		return 0;
	}
	if (parsed.rank === "A") {
		return 1;
	}
	if (parsed.rank === "J" || parsed.rank === "Q" || parsed.rank === "K") {
		return 10;
	}
	return Number(parsed.rank);
}

/** A hand's best total: one ace counts 11 when that doesn't go over 21. */
export function handValue(cards: readonly CardId[]) {
	const hard = cards.reduce((sum, card) => sum + cardValue(card), 0);
	const hasAce = cards.some((card) => parseCard(card).rank === "A");
	const soft = hasAce && hard + 10 <= TARGET;
	return { total: soft ? hard + 10 : hard, soft };
}

/** Eenentwintig in the first two cards. */
export function isNatural(cards: readonly CardId[]) {
	return cards.length === 2 && handValue(cards).total === TARGET;
}

/**
 * What one hand wins or loses against the bank's final cards. A bust always
 * loses, even when the bank goes bust too, and a natural beats a plain 21.
 */
export function settleHand(
	rules: Pick<BankRules, "naturalPays">,
	hand: readonly CardId[],
	bank: readonly CardId[],
	stake: number,
) {
	const player = handValue(hand).total;
	if (player > TARGET) {
		return -stake;
	}
	const playerNatural = isNatural(hand);
	const bankNatural = isNatural(bank);
	if (playerNatural || bankNatural) {
		if (playerNatural && bankNatural) {
			return 0;
		}
		return playerNatural ? Math.round(stake * rules.naturalPays) : -stake;
	}
	const dealer = handValue(bank).total;
	if (dealer > TARGET || player > dealer) {
		return stake;
	}
	return player === dealer ? 0 : -stake;
}

function totalsOf(results: readonly number[][], seats: number) {
	return Array.from({ length: seats }, (_, seat) =>
		results.reduce((sum, round) => sum + (round[seat] ?? 0), 0),
	);
}

export function createBank(
	rules: BankRules,
	seats: number,
	random: Rng,
	starter = 0,
): BankState {
	return {
		family: "bank",
		hands: Array.from({ length: seats }, () => []),
		bank: [],
		stock: shuffle(buildDeck(rules.decks, 0), random),
		discard: [],
		stakes: Array.from({ length: seats }, () => null),
		done: Array.from({ length: seats }, () => false),
		turn: starter,
		starter,
		phase: "stake",
		round: 1,
		bankRevealed: false,
		results: [],
		winners: [],
		events: [],
		nextSeq: 0,
	};
}

/** Who plays first in the rematch: the next seat along. */
export function nextBankStarter(state: BankState) {
	return (state.starter + 1) % state.hands.length;
}

/** Who plays first this round: the lead moves one seat each round. */
function roundStarter(state: BankState) {
	return (state.starter + state.round - 1) % state.hands.length;
}

function draw(state: BankState, random: Rng) {
	const [card] = drawWithReshuffle(state, 1, random);
	if (!card) {
		// Several decks cover any table; this would be a broken deck config.
		throw new GameRuleError("cardsDiscardEmpty");
	}
	return card;
}

/** Last round's cards go to the discard pile, and a low stock is shuffled anew. */
function dealRound(rules: BankRules, state: BankState, random: Rng) {
	state.discard.push(...state.hands.flat(), ...state.bank);
	const seats = state.hands.length;
	// Enough for every hand to draw well past 21 without running dry.
	if (state.stock.length < (seats + 1) * 6) {
		state.stock = shuffle([...state.stock, ...state.discard], random);
		state.discard = [];
		pushEvent(state, { type: "reshuffle" });
	}
	state.hands = state.hands.map(() => []);
	state.bank = [];
	state.bankRevealed = false;
	for (let pass = 0; pass < 2; pass += 1) {
		for (const hand of state.hands) {
			hand.push(draw(state, random));
		}
		state.bank.push(draw(state, random));
	}
	state.phase = "play";
	pushEvent(state, {
		type: "deal",
		round: state.round,
		perSeat: 2,
		bank: true,
	});
	state.done = state.hands.map((hand) => isNatural(hand));
	state.hands.forEach((hand, seat) => {
		if (isNatural(hand)) {
			pushEvent(state, { type: "natural", seat });
		}
	});
	passTurn(rules, state, roundStarter(state), random);
}

/**
 * Gives the turn to the first seat from `from` still playing. When every hand
 * is over (all naturals, or the last player just finished), the bank plays.
 */
function passTurn(
	rules: BankRules,
	state: BankState,
	from: number,
	random: Rng,
) {
	const seats = state.hands.length;
	for (let step = 0; step < seats; step += 1) {
		const seat = (from + step) % seats;
		if (!state.done[seat]) {
			state.turn = seat;
			return;
		}
	}
	bankPlays(rules, state, random);
}

function bankShouldDraw(rules: BankRules, cards: readonly CardId[]) {
	const { total, soft } = handValue(cards);
	return (
		total < rules.bankStandsOn ||
		(rules.bankHitsSoft && soft && total === rules.bankStandsOn)
	);
}

/** The bank shows its card, draws by the rules, and every hand is settled. */
function bankPlays(rules: BankRules, state: BankState, random: Rng) {
	state.bankRevealed = true;
	pushEvent(state, {
		type: "bankReveal",
		card: state.bank[1],
		total: handValue(state.bank).total,
	});
	// With every hand bust or a natural, nothing is left to draw for.
	const contested = state.hands.some(
		(hand) => handValue(hand).total <= TARGET && !isNatural(hand),
	);
	while (contested && bankShouldDraw(rules, state.bank)) {
		const card = draw(state, random);
		state.bank.push(card);
		pushEvent(state, {
			type: "bankDraw",
			card,
			total: handValue(state.bank).total,
		});
	}
	const round = state.hands.map((hand, seat) =>
		settleHand(rules, hand, state.bank, state.stakes[seat] ?? 0),
	);
	state.results.push(round);
	pushEvent(state, {
		type: "settle",
		round: state.round,
		results: round,
		bankTotal: handValue(state.bank).total,
	});
	if (state.round >= rules.rounds) {
		state.phase = "finished";
		const totals = totalsOf(state.results, state.hands.length);
		const best = Math.max(...totals);
		state.winners = totals.flatMap((total, seat) =>
			total === best ? [seat] : [],
		);
		pushEvent(state, { type: "win", seats: state.winners });
		return;
	}
	state.round += 1;
	state.phase = "stake";
	state.stakes = state.stakes.map(() => null);
	state.done = state.done.map(() => false);
}

/** Ends this seat's hand and moves on; after the last hand the bank plays. */
function finishHand(
	rules: BankRules,
	state: BankState,
	seat: number,
	random: Rng,
) {
	state.done[seat] = true;
	passTurn(rules, state, seat + 1, random);
}

function applyStake(
	rules: BankRules,
	state: BankState,
	seat: number,
	amount: number,
	random: Rng,
) {
	if (state.phase !== "stake") {
		throw new GameRuleError("cardsStakesClosed");
	}
	if (!rules.stakes.includes(amount)) {
		throw new GameRuleError("cardsBadStake");
	}
	if (state.stakes[seat] !== null) {
		throw new GameRuleError("cardsAlreadyStaked");
	}
	state.stakes[seat] = amount;
	pushEvent(state, { type: "stake", seat, amount });
	if (state.stakes.every((stake) => stake !== null)) {
		dealRound(rules, state, random);
	}
}

function requirePlayTurn(state: BankState, seat: number) {
	if (state.phase === "stake") {
		throw new GameRuleError("cardsWaitForStakes");
	}
	if (state.turn !== seat) {
		throw new GameRuleError("notYourTurn");
	}
}

function canDouble(rules: BankRules, state: BankState, seat: number) {
	return (
		rules.doubleDown && state.hands[seat].length === 2 && !state.done[seat]
	);
}

export function applyBank(
	rules: BankRules,
	previous: BankState,
	seat: number,
	action: BankAction,
	random: Rng,
): BankState {
	const state = clone(previous);
	if (state.phase === "finished") {
		throw new GameRuleError("gameAlreadyFinished");
	}
	switch (action.type) {
		case "stake":
			applyStake(rules, state, seat, action.amount, random);
			return state;
		case "hit": {
			requirePlayTurn(state, seat);
			const card = draw(state, random);
			state.hands[seat].push(card);
			const total = handValue(state.hands[seat]).total;
			pushEvent(state, { type: "hit", seat, card, total });
			if (total > TARGET) {
				pushEvent(state, { type: "bust", seat, total });
			}
			if (total >= TARGET) {
				finishHand(rules, state, seat, random);
			}
			return state;
		}
		case "stand":
			requirePlayTurn(state, seat);
			pushEvent(state, {
				type: "stand",
				seat,
				total: handValue(state.hands[seat]).total,
			});
			finishHand(rules, state, seat, random);
			return state;
		case "double": {
			requirePlayTurn(state, seat);
			if (!canDouble(rules, state, seat)) {
				throw new GameRuleError("cardsCannotDouble");
			}
			const card = draw(state, random);
			state.hands[seat].push(card);
			state.stakes[seat] = (state.stakes[seat] ?? 0) * 2;
			const total = handValue(state.hands[seat]).total;
			pushEvent(state, { type: "double", seat, card, total });
			if (total > TARGET) {
				pushEvent(state, { type: "bust", seat, total });
			}
			finishHand(rules, state, seat, random);
			return state;
		}
	}
}

export function viewBank(
	rules: BankRules,
	state: BankState,
	seat: number | null,
): BankView {
	const playing = state.phase === "play";
	const isTurn = seat !== null && playing && state.turn === seat;
	const bank = state.bank.map((card, index) =>
		index === 1 && !state.bankRevealed ? null : card,
	);
	return {
		family: "bank",
		phase: state.phase,
		turn: state.turn,
		round: state.round,
		totalRounds: rules.rounds,
		hands: state.hands,
		handTotals: state.hands.map((hand) => handValue(hand).total),
		handCounts: state.hands.map((hand) => hand.length),
		bank,
		bankTotal: handValue(bank.filter((card) => card !== null)).total,
		stockCount: state.stock.length,
		stakes: state.stakes,
		results: state.results,
		totals: totalsOf(state.results, state.hands.length),
		stakeOptions: rules.stakes,
		canStake:
			seat !== null && state.phase === "stake" && state.stakes[seat] === null,
		canDouble: isTurn && canDouble(rules, state, seat),
		winners: state.winners,
		events: state.events,
	};
}

// The computer player, which also plays autopiloted seats.

/** A simple chart: stand on 17, stand on 12-16 against a weak bank card. */
function botPlay(rules: BankRules, state: BankState, seat: number): BankAction {
	const { total, soft } = handValue(state.hands[seat]);
	const up = cardValue(state.bank[0]);
	const bankUp = up === 1 ? 11 : up;
	if (
		canDouble(rules, state, seat) &&
		!soft &&
		(total === 10 || total === 11)
	) {
		if (bankUp < total) {
			return { type: "double" };
		}
	}
	if (soft) {
		return total >= 18 ? { type: "stand" } : { type: "hit" };
	}
	if (total >= 17) {
		return { type: "stand" };
	}
	if (total >= 12 && bankUp >= 2 && bankUp <= 6) {
		return { type: "stand" };
	}
	return { type: "hit" };
}

export function botBankMove(
	rules: BankRules,
	state: BankState,
	bots: readonly number[],
	random: Rng,
): BotMove<BankAction> | null {
	if (state.phase === "stake") {
		const seat = bots.find((bot) => state.stakes[bot] === null);
		if (seat === undefined) {
			return null;
		}
		const amount =
			rules.stakes[Math.floor(random() * rules.stakes.length)] ??
			rules.stakes[0];
		return { seat, action: { type: "stake", amount }, pace: "followUp" };
	}
	if (state.phase !== "play" || !bots.includes(state.turn)) {
		return null;
	}
	return {
		seat: state.turn,
		action: botPlay(rules, state, state.turn),
		pace: "turn",
	};
}
