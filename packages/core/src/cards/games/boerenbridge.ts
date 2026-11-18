import type { CardGameDefinition } from "../engine";
import type { TricksBidding } from "../tricks";

const BIDDING = {
	dealerMayMatch: false,
	exact: 10,
	perTrick: 2,
	perTrickOff: 2,
} as const satisfies TricksBidding;

/**
 * Boerenbridge: bid the exact number of tricks you will take. Hands grow by a
 * card a round up to what the deck allows for the table, then shrink again,
 * and the top undealt card sets trump. Every rule below is data; the tricks
 * family has no Boerenbridge-specific code. Text lives in the message catalog
 * under `games.cards.games.boerenbridge`.
 */
export const boerenbridge = {
	id: "boerenbridge",
	family: "tricks",
	felt: "bottle",
	showcase: ["SA#0", "HK#0", "D10#0", "C7#0"],
	players: { min: 3, max: 7 },
	rules: {
		ranks: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"],
		stripped: {},
		passing: null,
		// Short hands leave cards undealt, so no fixed card can open a deal.
		firstLead: null,
		breaking: null,
		schedule: "upDown",
		trumpChoice: "turnUp",
		seating: "alone",
		scoring: "bids",
		suitPoints: {},
		cardPoints: {},
		shootTheMoon: false,
		target: null,
		bidding: BIDDING,
		highWins: true,
	},
	options: [
		{ id: "upOnly", patch: { schedule: "up" }, group: "schedule" },
		{ id: "downOnly", patch: { schedule: "down" }, group: "schedule" },
		{ id: "noTrump", patch: { trumpChoice: "none" } },
		{
			id: "dealerFree",
			patch: { bidding: { ...BIDDING, dealerMayMatch: true } },
		},
	],
} as const satisfies CardGameDefinition;
