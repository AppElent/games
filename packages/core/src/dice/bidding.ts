/**
 * The bidding family: every player shakes a cup of hidden dice, then in turn
 * each bids how many dice on the whole table show a face, higher every time,
 * until someone calls the last bid a lie. The cups are revealed, whoever was
 * wrong loses a die, and the last player with dice wins. Wild ones, the exact
 * ("spot on") call and the number of starting dice are rules, so liar's dice
 * and its cousins differ only in config.
 *
 * The cups are the only secret at the table: the view gives a seat its own
 * cup and every cup only after a call, as `reveal`.
 */
import { GameRuleError } from "../errors";
import type { Rng } from "../random";
import type { BotMove } from "../table-engine";
import {
	DIE_FACES,
	type DiceEvent,
	nextSeat,
	pushDiceEvent,
	rollDice,
} from "./table";

export type BiddingRules = {
	/** Dice in every cup at the start. */
	startingDice: number;
	/** Ones count as every other face; a bid on ones needs only half as many. */
	wildOnes: boolean;
	/** The player to move may call the last bid exactly right instead of a lie. */
	spotOn: boolean;
};

export type Bid = { quantity: number; face: number };
export type PlacedBid = Bid & { seat: number };

export type BiddingCall = "liar" | "spotOn";

/** A round's end, public once called: every cup as it was, and who paid for it. */
export type Reveal = {
	call: BiddingCall;
	caller: number;
	bid: PlacedBid;
	/** Every cup at the call, by seat; empty for a seat already out. */
	cups: number[][];
	/** How many dice showed the bid's face, wild ones included. */
	count: number;
	/** Each of these seats lost one die. */
	losers: number[];
};

export type BiddingState = {
	family: "bidding";
	phase: "playing" | "finished";
	seats: number;
	/** Who opened the game, so a rematch passes the opening on. */
	starter: number;
	turn: number;
	round: number;
	/** Hidden: each seat's dice. An empty cup is a seat that is out. */
	cups: number[][];
	/** This round's bids, oldest first. */
	bids: PlacedBid[];
	/** How the last round ended; null in the first round. */
	reveal: Reveal | null;
	/** The round each seat lost its last die in; null while it still plays. */
	outIn: Array<number | null>;
	winners: number[];
	events: DiceEvent[];
	nextSeq: number;
};

export type BiddingAction =
	| { type: "bid"; quantity: number; face: number }
	/** The last bid is a lie: there are fewer dice than it says. */
	| { type: "liar" }
	/** The last bid is exactly right; only when the rules allow it. */
	| { type: "spotOn" };

export const BIDDING_ACTIONS = { bid: true, liar: true, spotOn: true } as const;

export type BiddingView = {
	family: "bidding";
	phase: BiddingState["phase"];
	turn: number;
	round: number;
	rules: BiddingRules;
	/** Dice left per seat: public, unlike their faces. */
	diceCounts: number[];
	totalDice: number;
	/** The viewer's own cup; empty for a spectator or a player who is out. */
	yourDice: number[];
	bids: PlacedBid[];
	reveal: Reveal | null;
	outIn: Array<number | null>;
	winners: number[];
	events: DiceEvent[];
};

const isWild = (rules: Pick<BiddingRules, "wildOnes">, face: number) =>
	rules.wildOnes && face !== 1;

/** How many of these dice count toward a bid on `face`. */
export function countMatching(
	values: readonly number[],
	face: number,
	rules: Pick<BiddingRules, "wildOnes">,
) {
	return values.filter(
		(value) => value === face || (isWild(rules, face) && value === 1),
	).length;
}

/**
 * The fewest dice of `face` that outrank `previous`. Without wild ones that is
 * more dice, or as many of a higher face. With them, ones count double: a bid
 * on ones needs half the previous quantity (rounded up), and leaving ones
 * needs twice their quantity plus one.
 */
export function minimumQuantity(
	previous: Bid | null,
	face: number,
	rules: Pick<BiddingRules, "wildOnes">,
) {
	if (!previous) {
		return 1;
	}
	if (rules.wildOnes && (face === 1 || previous.face === 1)) {
		if (face === 1 && previous.face === 1) {
			return previous.quantity + 1;
		}
		return face === 1
			? Math.ceil(previous.quantity / 2)
			: previous.quantity * 2 + 1;
	}
	return face > previous.face ? previous.quantity : previous.quantity + 1;
}

/** Whether `next` is a legal bid after `previous` (null: it opens the round). */
export function bidOutranks(
	previous: Bid | null,
	next: Bid,
	rules: Pick<BiddingRules, "wildOnes">,
) {
	return next.quantity >= minimumQuantity(previous, next.face, rules);
}

/** Every face's lowest legal bid on a table of `totalDice`, low faces first. */
export function lowestBids(
	previous: Bid | null,
	totalDice: number,
	rules: Pick<BiddingRules, "wildOnes">,
): Bid[] {
	return DIE_FACES.flatMap((face) => {
		const quantity = minimumQuantity(previous, face, rules);
		return quantity <= totalDice ? [{ quantity, face }] : [];
	});
}

const sum = (values: readonly number[]) =>
	values.reduce((total, value) => total + value, 0);

const diceLeft = (state: Pick<BiddingState, "cups">) =>
	sum(state.cups.map((cup) => cup.length));

const outSeats = (state: Pick<BiddingState, "cups">) =>
	state.cups.map((cup) => cup.length === 0);

export function createBidding(
	rules: BiddingRules,
	seats: number,
	starter: number,
	random: Rng,
): BiddingState {
	const first = starter % seats;
	return {
		family: "bidding",
		phase: "playing",
		seats,
		starter: first,
		turn: first,
		round: 1,
		cups: Array.from({ length: seats }, () =>
			rollDice(random, rules.startingDice),
		),
		bids: [],
		reveal: null,
		outIn: Array.from({ length: seats }, () => null),
		winners: [],
		events: [],
		nextSeq: 0,
	};
}

/** The next game opens with the seat after this one's opener. */
export function nextBiddingStarter(state: BiddingState) {
	return nextSeat(state.starter, state.seats);
}

function copy(state: BiddingState): BiddingState {
	return {
		...state,
		cups: state.cups.map((cup) => [...cup]),
		bids: [...state.bids],
		outIn: [...state.outIn],
		winners: [...state.winners],
		events: [...state.events],
	};
}

function placeBid(rules: BiddingRules, state: BiddingState, bid: Bid) {
	const total = diceLeft(state);
	if (
		!Number.isInteger(bid.quantity) ||
		!Number.isInteger(bid.face) ||
		bid.face < 1 ||
		bid.face > 6 ||
		bid.quantity < 1 ||
		bid.quantity > total
	) {
		throw new GameRuleError("claimImpossible");
	}
	if (!bidOutranks(state.bids.at(-1) ?? null, bid, rules)) {
		throw new GameRuleError("claimMustOutrank");
	}
	const seat = state.turn;
	state.bids.push({ seat, quantity: bid.quantity, face: bid.face });
	pushDiceEvent(state, { type: "bid", seat, ...bid });
	state.turn = nextSeat(seat, state.seats, outSeats(state));
}

/** Reveals every cup, takes the losers' dice, and deals the next round or ends the game. */
function call(
	rules: BiddingRules,
	state: BiddingState,
	kind: BiddingCall,
	random: Rng,
) {
	if (kind === "spotOn" && !rules.spotOn) {
		throw new GameRuleError("diceSpotOnOff");
	}
	const bid = state.bids.at(-1);
	if (!bid) {
		throw new GameRuleError("noClaimToChallenge");
	}
	const caller = state.turn;
	const count = sum(
		state.cups.map((cup) => countMatching(cup, bid.face, rules)),
	);
	let losers: number[];
	if (kind === "liar") {
		losers = [count >= bid.quantity ? caller : bid.seat];
	} else {
		losers =
			count === bid.quantity
				? state.cups.flatMap((cup, seat) =>
						seat !== caller && cup.length > 0 ? [seat] : [],
					)
				: [caller];
	}
	state.reveal = {
		call: kind,
		caller,
		bid,
		cups: state.cups.map((cup) => [...cup]),
		count,
		losers,
	};
	pushDiceEvent(state, {
		type: "call",
		seat: caller,
		call: kind,
		bidder: bid.seat,
		quantity: bid.quantity,
		face: bid.face,
		count,
		losers,
	});
	for (const seat of losers) {
		state.cups[seat] = state.cups[seat].slice(1);
		if (state.cups[seat].length === 0) {
			state.outIn[seat] = state.round;
		}
	}
	state.bids = [];
	const alive = state.cups.flatMap((cup, seat) =>
		cup.length > 0 ? [seat] : [],
	);
	if (alive.length <= 1) {
		state.phase = "finished";
		state.winners = alive;
		pushDiceEvent(state, { type: "win", seats: alive });
		return;
	}
	// A lone loser opens the next round, or the player after them once they are out.
	const opener = losers.length === 1 ? losers[0] : caller;
	state.turn =
		state.cups[opener].length > 0
			? opener
			: nextSeat(opener, state.seats, outSeats(state));
	state.round += 1;
	state.cups = state.cups.map((cup) => rollDice(random, cup.length));
}

export function applyBidding(
	rules: BiddingRules,
	state: BiddingState,
	seat: number,
	action: BiddingAction,
	random: Rng,
): BiddingState {
	if (state.phase !== "playing") {
		throw new GameRuleError("noActiveGame");
	}
	if (seat !== state.turn) {
		throw new GameRuleError("notYourTurn");
	}
	const next = copy(state);
	if (action.type === "bid") {
		placeBid(rules, next, { quantity: action.quantity, face: action.face });
	} else {
		call(rules, next, action.type, random);
	}
	return next;
}

/** Only the viewer's own cup: everyone else's dice stay hidden until a call reveals them. */
export function viewBidding(
	rules: BiddingRules,
	state: BiddingState,
	seat: number | null,
): BiddingView {
	const diceCounts = state.cups.map((cup) => cup.length);
	return {
		family: "bidding",
		phase: state.phase,
		turn: state.turn,
		round: state.round,
		rules,
		diceCounts,
		totalDice: sum(diceCounts),
		yourDice: seat === null ? [] : [...(state.cups[seat] ?? [])],
		bids: state.bids,
		reveal: state.reveal,
		outIn: state.outIn,
		winners: state.winners,
		events: state.events,
	};
}

// The bot: it sees only its own cup, counts how many of the other dice should
// match each face, and weighs the chance that the last bid holds against the
// chance that its own best raise would.

function choose(n: number, k: number) {
	let result = 1;
	for (let i = 1; i <= k; i += 1) {
		result = (result * (n - k + i)) / i;
	}
	return result;
}

/** P(X = k) for X ~ Binomial(n, p). */
function binomial(n: number, k: number, p: number) {
	if (k < 0 || k > n) {
		return 0;
	}
	return choose(n, k) * p ** k * (1 - p) ** (n - k);
}

/** P(X >= k) for X ~ Binomial(n, p). */
function atLeast(n: number, k: number, p: number) {
	let total = 0;
	for (let i = Math.max(0, k); i <= n; i += 1) {
		total += binomial(n, i, p);
	}
	return Math.min(1, total);
}

/** How likely a die the bot cannot see shows `face`, wild ones included. */
function matchChance(rules: BiddingRules, face: number) {
	return isWild(rules, face) ? 2 / 6 : 1 / 6;
}

/**
 * What the bot believes about a bid: its own cup, one die for each other
 * player who has bid that face this round (people bid what they hold), and the
 * odds for the rest of the hidden dice.
 */
export function bidChances(
	rules: BiddingRules,
	own: readonly number[],
	totalDice: number,
	bid: Bid,
	credited = 0,
) {
	const unseen = totalDice - own.length - credited;
	const needed = bid.quantity - countMatching(own, bid.face, rules) - credited;
	const p = matchChance(rules, bid.face);
	return {
		/** The bid holds: at least that many dice. */
		holds: atLeast(unseen, needed, p),
		/** The bid is exactly right. */
		exact: binomial(unseen, needed, p),
	};
}

/** How many other players have bid each face this round. */
function bidders(bids: readonly PlacedBid[], seat: number) {
	const seen = DIE_FACES.map(() => new Set<number>());
	for (const bid of bids) {
		if (bid.seat !== seat) {
			seen[bid.face - 1].add(bid.seat);
		}
	}
	return (face: number) => seen[face - 1].size;
}

/** Raises this close to the best one are as good, so the bot varies its bids. */
const RAISE_SLACK = 0.08;
/** An exact call costs the caller a die more often than not; it needs this much confidence. */
const SPOT_ON_CONFIDENCE = 0.4;

export function botBiddingMove(
	rules: BiddingRules,
	state: BiddingState,
	bots: readonly number[],
	random: Rng,
): BotMove<BiddingAction> | null {
	if (state.phase !== "playing" || !bots.includes(state.turn)) {
		return null;
	}
	const seat = state.turn;
	const own = state.cups[seat];
	const total = diceLeft(state);
	const last = state.bids.at(-1) ?? null;
	// Give people a moment with the reveal before the next round opens.
	const pace = !last && state.reveal ? "reaction" : "turn";

	if (!last) {
		// Open on what the bot holds most of, as many as it expects on the table.
		let best: Bid = { quantity: 1, face: 6 };
		let bestExpected = -1;
		for (const face of DIE_FACES) {
			const expected =
				countMatching(own, face, rules) +
				(total - own.length) * matchChance(rules, face);
			// Ones count double when they are wild, so compare them as such.
			const weighed = rules.wildOnes && face === 1 ? expected * 2 : expected;
			if (weighed > bestExpected) {
				best = { face, quantity: Math.max(1, Math.floor(expected)) };
				bestExpected = weighed;
			}
		}
		return { seat, action: { type: "bid", ...best }, pace };
	}

	const credit = bidders(state.bids, seat);
	const lastChances = bidChances(rules, own, total, last, credit(last.face));
	const raises = lowestBids(last, total, rules).map((bid) => ({
		bid,
		holds: bidChances(rules, own, total, bid, credit(bid.face)).holds,
	}));
	const bestHolds = Math.max(0, ...raises.map((raise) => raise.holds));
	if (
		rules.spotOn &&
		lastChances.exact >= SPOT_ON_CONFIDENCE &&
		lastChances.exact >= 1 - lastChances.holds
	) {
		return { seat, action: { type: "spotOn" }, pace };
	}
	if (raises.length === 0 || 1 - lastChances.holds > bestHolds) {
		return { seat, action: { type: "liar" }, pace };
	}
	const good = raises.filter((raise) => raise.holds >= bestHolds - RAISE_SLACK);
	const pick = good[Math.floor(random() * good.length)] ?? good[0];
	return { seat, action: { type: "bid", ...pick.bid }, pace };
}
