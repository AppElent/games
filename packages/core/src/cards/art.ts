/**
 * The deck's artwork as plain shapes on a 100x140 card, so the web and the app
 * draw the same cards. Our own design: Art Deco courts and a jester, not a copy
 * of any commercial deck. Each client only renders these shapes.
 */
import { type CardId, parseCard, type Rank, type Suit } from "./deck";

export const CARD_ASPECT = 140 / 100;

const INK = "#17181f";
const RED = "#b81f2d";
const GOLD = "#c6962f";
const NAVY = "#1d2f6b";
const SKIN = "#f4dfc6";
const COURT_PAPER = "#f3ead2";
const EDGE = "#d9cfb4";
const BACK = "#131a3c";
const BACK_LINE = "#d7a93f";
const BACK_INK = "#e8c368";

export const CARD_PAPER = "#fbf7ec";

export const SUIT_PATHS: Record<Suit, string> = {
	H: "M50 92C21 66 5 49 5 29 5 14 16 5 29 5c9 0 17 5 21 14C54 10 62 5 71 5c13 0 24 9 24 24 0 20-16 37-45 63Z",
	D: "M50 3c10 17 22 33 38 47-16 14-28 30-38 47-10-17-22-33-38-47C28 36 40 20 50 3Z",
	S: "M50 4c10 19 43 36 43 59 0 14-11 22-22 22-7 0-13-3-16-8 1 8 4 14 10 20H35c6-6 9-12 10-20-3 5-9 8-16 8C18 85 7 77 7 63 7 40 40 23 50 4Z",
	C: "M50 5a21 21 0 0 1 18 32 21 21 0 1 1-13 37c1 9 4 16 10 23H35c6-7 9-14 10-23a21 21 0 1 1-13-37A21 21 0 0 1 50 5Z",
};

export function suitColor(suit: Suit) {
	return suit === "H" || suit === "D" ? RED : INK;
}

export type ArtShape =
	| {
			kind: "path";
			d: string;
			fill?: string;
			stroke?: string;
			strokeWidth?: number;
			opacity?: number;
	  }
	| { kind: "circle"; cx: number; cy: number; r: number; fill: string }
	| {
			kind: "rect";
			x: number;
			y: number;
			width: number;
			height: number;
			rx?: number;
			fill?: string;
			stroke?: string;
			strokeWidth?: number;
	  }
	/** A suit symbol centred on x,y, `size` wide. */
	| {
			kind: "pip";
			suit: Suit;
			x: number;
			y: number;
			size: number;
			flip?: boolean;
	  }
	| {
			kind: "text";
			value: string;
			x: number;
			y: number;
			size: number;
			fill: string;
			weight: 700 | 800;
			spacing?: number;
			transform?: string;
	  }
	| { kind: "group"; transform: string; shapes: ArtShape[] };

const line = (d: string, stroke: string, strokeWidth: number): ArtShape => ({
	kind: "path",
	d,
	stroke,
	strokeWidth,
	fill: "none",
});
const solid = (d: string, fill: string): ArtShape => ({
	kind: "path",
	d,
	fill,
});
const dot = (cx: number, cy: number, r: number, fill: string): ArtShape => ({
	kind: "circle",
	cx,
	cy,
	r,
	fill,
});
const upsideDown = (shapes: ArtShape[]): ArtShape => ({
	kind: "group",
	transform: "rotate(180 50 70)",
	shapes,
});

/** Pip centres; the lower half of the card is drawn upside down. */
const PIPS: Partial<Record<Rank, ReadonlyArray<readonly [number, number]>>> = {
	"2": [
		[50, 32],
		[50, 108],
	],
	"3": [
		[50, 32],
		[50, 70],
		[50, 108],
	],
	"4": [
		[34, 32],
		[66, 32],
		[34, 108],
		[66, 108],
	],
	"5": [
		[34, 32],
		[66, 32],
		[50, 70],
		[34, 108],
		[66, 108],
	],
	"6": [
		[34, 32],
		[66, 32],
		[34, 70],
		[66, 70],
		[34, 108],
		[66, 108],
	],
	"7": [
		[34, 32],
		[66, 32],
		[50, 51],
		[34, 70],
		[66, 70],
		[34, 108],
		[66, 108],
	],
	"8": [
		[34, 32],
		[66, 32],
		[50, 51],
		[34, 70],
		[66, 70],
		[50, 89],
		[34, 108],
		[66, 108],
	],
	"9": [
		[34, 28],
		[66, 28],
		[34, 56],
		[66, 56],
		[50, 70],
		[34, 84],
		[66, 84],
		[34, 112],
		[66, 112],
	],
	"10": [
		[34, 28],
		[66, 28],
		[50, 42],
		[34, 56],
		[66, 56],
		[34, 84],
		[66, 84],
		[50, 98],
		[34, 112],
		[66, 112],
	],
};

/** One half of a court figure; the card mirrors it, like a real double-ended court. */
function courtHalf(rank: "J" | "Q" | "K", suit: Suit): ArtShape[] {
	const main = suitColor(suit);
	const second = main === RED ? NAVY : RED;
	const robe = [
		solid("M27 70V60l15-7h16l15 7v10Z", second),
		solid("M42 53l8 17 8-17Z", main),
		line("M34 70l8-17M66 70l-8-17M50 70V53", GOLD, 1.3),
		solid("M27 64l6-3v9h-6ZM73 64l-6-3v9h6Z", GOLD),
	];
	const face = [
		solid("M41 33h18l-1 13-5 6h-6l-5-6Z", SKIN),
		line("M44.5 39h3.5M52 39h3.5", INK, 1.5),
		line("M50 39v6", INK, 0.8),
	];
	if (rank === "K") {
		return [
			...robe,
			...face,
			solid("M41 44l6 8h6l6-8 1 6-6 8h-8l-6-8Z", main),
			line("M46.5 47.5h7", SKIN, 1),
			solid("M38 28V17l6 6 6-9 6 9 6-6v11Z", GOLD),
			solid("M38 28h24v5H38Z", main),
			dot(50, 30.5, 1.4, GOLD),
			dot(43, 30.5, 1, GOLD),
			dot(57, 30.5, 1, GOLD),
			line("M69 17v41M65 25h8", GOLD, 2),
			solid("M69 13l2 4h-4Z", GOLD),
		];
	}
	if (rank === "Q") {
		return [
			...robe,
			solid("M37 32c0-12 26-12 26 0l2 24-7-4V34H42v18l-7 4Z", main),
			...face,
			line("M48 47.5h4", RED, 1.3),
			solid("M40 27c3-9 17-9 20 0l-2.5 3h-15Z", GOLD),
			dot(50, 20, 2, GOLD),
			dot(44, 22, 1.3, GOLD),
			dot(56, 22, 1.3, GOLD),
			line("M69 58V30", GOLD, 1.6),
			dot(69, 27, 3.4, second),
			dot(69, 27, 1.3, GOLD),
		];
	}
	return [
		...robe,
		solid("M39 33h22v13l-3-3V36H42v7l-3 3Z", GOLD),
		...face,
		solid("M37 33l3-11 20-1 4 12Z", main),
		line("M37 33h27", GOLD, 2),
		solid("M60 22c5-7 10-7 12-5-3 2-6 5-8 11Z", GOLD),
		line("M70 58V24", GOLD, 2),
		solid("M70 24l-4 7h8Z", second),
	];
}

function courtArt(rank: "J" | "Q" | "K", suit: Suit): ArtShape[] {
	const half = [
		...courtHalf(rank, suit),
		{ kind: "pip", suit, x: 31, y: 23, size: 12 } as const,
	];
	return [
		{
			kind: "rect",
			x: 22,
			y: 12,
			width: 56,
			height: 116,
			rx: 3,
			fill: COURT_PAPER,
			stroke: GOLD,
			strokeWidth: 1,
		},
		...half,
		upsideDown(half),
		line("M22 76l56-12", GOLD, 2.4),
	];
}

function jesterHalf(tone: string): ArtShape[] {
	return [
		solid("M50 44 34 40c-4-8-11-12-16-12 7 4 9 12 9 22Z", tone),
		solid("M50 44 66 40c4-8 11-12 16-12-7 4-9 12-9 22Z", NAVY),
		solid("M50 44 41 36c0-9 4-16 9-21 5 5 9 12 9 21Z", GOLD),
		dot(18, 27, 3, GOLD),
		dot(82, 27, 3, GOLD),
		dot(50, 13, 3, tone),
		solid("M27 50c8-7 38-7 46 0-6 6-40 6-46 0Z", GOLD),
		solid("M38 50h24l-3 13-9 7-9-7Z", SKIN),
		line("M43 56h4M53 56h4", INK, 1.5),
		line("M44 62c3 3 9 3 12 0", tone, 1.5),
	];
}

function jokerArt(tone: string): ArtShape[] {
	const half = jesterHalf(tone);
	return [
		...half,
		upsideDown(half),
		{
			kind: "text",
			value: "J",
			x: 11,
			y: 24,
			size: 13,
			fill: tone,
			weight: 800,
		},
		solid(
			"M11 28l1.6 3.4 3.6.4-2.7 2.5.8 3.6-3.3-1.8-3.3 1.8.8-3.6-2.7-2.5 3.6-.4Z",
			GOLD,
		),
		{
			kind: "text",
			value: "J",
			x: 89,
			y: 116,
			size: 13,
			fill: tone,
			weight: 800,
			transform: "rotate(180 89 112)",
		},
	];
}

function cornerIndex(suit: Suit, glyph: string, wide: boolean): ArtShape[] {
	return [
		{
			kind: "text",
			value: glyph,
			x: 12.5,
			y: 20,
			size: wide ? 16.5 : 19.5,
			fill: suitColor(suit),
			weight: 700,
			spacing: wide ? -1.5 : undefined,
		},
		{ kind: "pip", suit, x: 12.5, y: 30, size: 12.5 },
	];
}

/** Everything on a card's face over its paper. `glyph` is the localized rank mark. */
export function cardFaceArt(card: CardId, glyph: string): ArtShape[] {
	const edge: ArtShape = {
		kind: "rect",
		x: 2.5,
		y: 2.5,
		width: 95,
		height: 135,
		rx: 5,
		stroke: EDGE,
		strokeWidth: 0.7,
	};
	const parsed = parseCard(card);
	if (parsed.joker) {
		const red = Number(card.split("#")[1]) % 2 === 1;
		return [edge, ...jokerArt(red ? RED : INK)];
	}
	const { suit, rank } = parsed;
	const index = cornerIndex(suit, glyph, rank === "10");
	const middle: ArtShape[] =
		rank === "A"
			? [{ kind: "pip", suit, x: 50, y: 70, size: 38 }]
			: rank === "J" || rank === "Q" || rank === "K"
				? courtArt(rank, suit)
				: (PIPS[rank] ?? []).map(([x, y]) => ({
						kind: "pip" as const,
						suit,
						x,
						y,
						size: rank === "9" || rank === "10" ? 17 : 19,
						flip: y > 70,
					}));
	return [edge, ...middle, ...index, upsideDown(index)];
}

/** Diagonal lattice lines cut off at the back's inner frame (x 7-93, y 7-133). */
function latticePath() {
	const STEP = 15.56;
	const [left, right, top, bottom] = [7, 93, 7, 133];
	const lines: string[] = [];
	for (let c = top - right; c <= bottom - left; c += STEP) {
		const x1 = Math.max(left, top - c);
		const x2 = Math.min(right, bottom - c);
		if (x2 > x1) {
			lines.push(`M${x1} ${x1 + c}L${x2} ${x2 + c}`);
		}
	}
	for (let c = top + left; c <= bottom + right; c += STEP) {
		const x1 = Math.max(left, c - bottom);
		const x2 = Math.min(right, c - top);
		if (x2 > x1) {
			lines.push(`M${x1} ${c - x1}L${x2} ${c - x2}`);
		}
	}
	return lines.join("");
}

const BACK_ART: ArtShape[] = [
	{ kind: "rect", x: 0, y: 0, width: 100, height: 140, fill: BACK },
	{
		kind: "path",
		d: latticePath(),
		stroke: BACK_LINE,
		strokeWidth: 0.8,
		fill: "none",
		opacity: 0.85,
	},
	{
		kind: "rect",
		x: 7,
		y: 7,
		width: 86,
		height: 126,
		rx: 3,
		stroke: BACK_LINE,
		strokeWidth: 1.4,
	},
	{
		kind: "rect",
		x: 10.5,
		y: 10.5,
		width: 79,
		height: 119,
		rx: 2,
		stroke: BACK_LINE,
		strokeWidth: 0.5,
	},
	{
		kind: "path",
		d: "M50 44 75 70 50 96 25 70Z",
		fill: BACK,
		stroke: BACK_LINE,
		strokeWidth: 1.4,
	},
	{
		kind: "path",
		d: "M50 50 69 70 50 90 31 70Z",
		fill: "none",
		stroke: BACK_LINE,
		strokeWidth: 0.5,
	},
	{
		kind: "text",
		value: "AC",
		x: 50,
		y: 76,
		size: 17,
		fill: BACK_INK,
		weight: 700,
		spacing: -0.5,
	},
];

export function cardBackArt(): readonly ArtShape[] {
	return BACK_ART;
}
