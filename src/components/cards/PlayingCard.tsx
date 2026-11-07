import {
	type CardId,
	cardCopy,
	parseCard,
	type Rank,
	type Suit,
} from "@arcadeclub/core/cards/deck";
import { memo } from "react";
import { useMessages } from "#/lib/i18n";

const INK = "#17181f";
const RED = "#b81f2d";
const GOLD = "#c6962f";
const NAVY = "#1d2f6b";
const SKIN = "#f4dfc6";
const PAPER = "#fbf7ec";

const SUIT_PATHS: Record<Suit, string> = {
	H: "M50 92C21 66 5 49 5 29 5 14 16 5 29 5c9 0 17 5 21 14C54 10 62 5 71 5c13 0 24 9 24 24 0 20-16 37-45 63Z",
	D: "M50 3c10 17 22 33 38 47-16 14-28 30-38 47-10-17-22-33-38-47C28 36 40 20 50 3Z",
	S: "M50 4c10 19 43 36 43 59 0 14-11 22-22 22-7 0-13-3-16-8 1 8 4 14 10 20H35c6-6 9-12 10-20-3 5-9 8-16 8C18 85 7 77 7 63 7 40 40 23 50 4Z",
	C: "M50 5a21 21 0 0 1 18 32 21 21 0 1 1-13 37c1 9 4 16 10 23H35c6-7 9-14 10-23a21 21 0 1 1-13-37A21 21 0 0 1 50 5Z",
};

function suitColor(suit: Suit) {
	return suit === "H" || suit === "D" ? RED : INK;
}

/** Pip centres on the 100x140 card; the lower half is drawn upside down. */
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

function Pip({
	suit,
	x,
	y,
	size,
	flip,
}: {
	suit: Suit;
	x: number;
	y: number;
	size: number;
	flip?: boolean;
}) {
	return (
		<use
			href={`#ac-suit-${suit}`}
			x={x - size / 2}
			y={y - size / 2}
			width={size}
			height={size}
			fill={suitColor(suit)}
			transform={flip ? `rotate(180 ${x} ${y})` : undefined}
		/>
	);
}

/** One half of a court figure; the card mirrors it, like a real double-ended court. */
function CourtHalf({ rank, suit }: { rank: "J" | "Q" | "K"; suit: Suit }) {
	const main = suitColor(suit);
	const second = main === RED ? NAVY : RED;
	const robe = (
		<>
			<path d="M27 70V60l15-7h16l15 7v10Z" fill={second} />
			<path d="M42 53l8 17 8-17Z" fill={main} />
			<path
				d="M34 70l8-17M66 70l-8-17M50 70V53"
				stroke={GOLD}
				strokeWidth="1.3"
				fill="none"
			/>
			<path d="M27 64l6-3v9h-6ZM73 64l-6-3v9h6Z" fill={GOLD} />
		</>
	);
	const face = (
		<>
			<path d="M41 33h18l-1 13-5 6h-6l-5-6Z" fill={SKIN} />
			<path d="M44.5 39h3.5M52 39h3.5" stroke={INK} strokeWidth="1.5" />
			<path d="M50 39v6" stroke={INK} strokeWidth=".8" />
		</>
	);
	if (rank === "K") {
		return (
			<>
				{robe}
				{face}
				<path d="M41 44l6 8h6l6-8 1 6-6 8h-8l-6-8Z" fill={main} />
				<path d="M46.5 47.5h7" stroke={SKIN} strokeWidth="1" />
				<path d="M38 28V17l6 6 6-9 6 9 6-6v11Z" fill={GOLD} />
				<path d="M38 28h24v5H38Z" fill={main} />
				<circle cx="50" cy="30.5" r="1.4" fill={GOLD} />
				<circle cx="43" cy="30.5" r="1" fill={GOLD} />
				<circle cx="57" cy="30.5" r="1" fill={GOLD} />
				<path d="M69 17v41M65 25h8" stroke={GOLD} strokeWidth="2" />
				<path d="M69 13l2 4h-4Z" fill={GOLD} />
			</>
		);
	}
	if (rank === "Q") {
		return (
			<>
				{robe}
				<path d="M37 32c0-12 26-12 26 0l2 24-7-4V34H42v18l-7 4Z" fill={main} />
				{face}
				<path d="M48 47.5h4" stroke={RED} strokeWidth="1.3" />
				<path d="M40 27c3-9 17-9 20 0l-2.5 3h-15Z" fill={GOLD} />
				<circle cx="50" cy="20" r="2" fill={GOLD} />
				<circle cx="44" cy="22" r="1.3" fill={GOLD} />
				<circle cx="56" cy="22" r="1.3" fill={GOLD} />
				<path d="M69 58V30" stroke={GOLD} strokeWidth="1.6" />
				<circle cx="69" cy="27" r="3.4" fill={second} />
				<circle cx="69" cy="27" r="1.3" fill={GOLD} />
			</>
		);
	}
	return (
		<>
			{robe}
			<path d="M39 33h22v13l-3-3V36H42v7l-3 3Z" fill={GOLD} />
			{face}
			<path d="M37 33l3-11 20-1 4 12Z" fill={main} />
			<path d="M37 33h27" stroke={GOLD} strokeWidth="2" />
			<path d="M60 22c5-7 10-7 12-5-3 2-6 5-8 11Z" fill={GOLD} />
			<path d="M70 58V24" stroke={GOLD} strokeWidth="2" />
			<path d="M70 24l-4 7h8Z" fill={second} />
		</>
	);
}

function Court({ rank, suit }: { rank: "J" | "Q" | "K"; suit: Suit }) {
	return (
		<>
			<rect
				x="22"
				y="12"
				width="56"
				height="116"
				rx="3"
				fill="#f3ead2"
				stroke={GOLD}
				strokeWidth="1"
			/>
			<g>
				<CourtHalf rank={rank} suit={suit} />
				<Pip suit={suit} x={31} y={23} size={12} />
			</g>
			<g transform="rotate(180 50 70)">
				<CourtHalf rank={rank} suit={suit} />
				<Pip suit={suit} x={31} y={23} size={12} />
			</g>
			<path d="M22 76l56-12" stroke={GOLD} strokeWidth="2.4" />
		</>
	);
}

function JesterHalf({ tone }: { tone: string }) {
	return (
		<>
			<path d="M50 44 34 40c-4-8-11-12-16-12 7 4 9 12 9 22Z" fill={tone} />
			<path d="M50 44 66 40c4-8 11-12 16-12-7 4-9 12-9 22Z" fill={NAVY} />
			<path d="M50 44 41 36c0-9 4-16 9-21 5 5 9 12 9 21Z" fill={GOLD} />
			<circle cx="18" cy="27" r="3" fill={GOLD} />
			<circle cx="82" cy="27" r="3" fill={GOLD} />
			<circle cx="50" cy="13" r="3" fill={tone} />
			<path d="M27 50c8-7 38-7 46 0-6 6-40 6-46 0Z" fill={GOLD} />
			<path d="M38 50h24l-3 13-9 7-9-7Z" fill={SKIN} />
			<path d="M43 56h4M53 56h4" stroke={INK} strokeWidth="1.5" />
			<path
				d="M44 62c3 3 9 3 12 0"
				stroke={tone}
				strokeWidth="1.5"
				fill="none"
			/>
		</>
	);
}

function JokerFace({ red }: { red: boolean }) {
	const tone = red ? RED : INK;
	return (
		<>
			<g>
				<JesterHalf tone={tone} />
			</g>
			<g transform="rotate(180 50 70)">
				<JesterHalf tone={tone} />
			</g>
			<g fill={tone} fontFamily="var(--font-display)" fontWeight="800">
				<text x="11" y="24" fontSize="13" textAnchor="middle">
					J
				</text>
				<path
					d="M11 28l1.6 3.4 3.6.4-2.7 2.5.8 3.6-3.3-1.8-3.3 1.8.8-3.6-2.7-2.5 3.6-.4Z"
					fill={GOLD}
				/>
				<text
					x="89"
					y="116"
					fontSize="13"
					textAnchor="middle"
					transform="rotate(180 89 112)"
				>
					J
				</text>
			</g>
		</>
	);
}

function CardIndex({
	suit,
	glyph,
	wide,
	color,
}: {
	suit: Suit;
	glyph: string;
	wide: boolean;
	color: string;
}) {
	return (
		<>
			<text
				x="12.5"
				y="20"
				fill={color}
				fontFamily="var(--font-display)"
				fontWeight="700"
				fontSize={wide ? 16.5 : 19.5}
				textAnchor="middle"
				letterSpacing={wide ? "-1.5" : undefined}
			>
				{glyph}
			</text>
			<Pip suit={suit} x={12.5} y={30} size={12.5} />
		</>
	);
}

function Face({
	card,
	glyph,
}: {
	card: Exclude<ReturnType<typeof parseCard>, { joker: true }>;
	glyph: string;
}) {
	const { suit, rank } = card;
	const pips = PIPS[rank];
	const color = suitColor(suit);
	return (
		<>
			{pips
				? pips.map(([x, y]) => (
						<Pip
							key={`${x}-${y}`}
							suit={suit}
							x={x}
							y={y}
							size={rank === "9" || rank === "10" ? 17 : 19}
							flip={y > 70}
						/>
					))
				: null}
			{rank === "A" ? <Pip suit={suit} x={50} y={70} size={38} /> : null}
			{rank === "J" || rank === "Q" || rank === "K" ? (
				<Court rank={rank} suit={suit} />
			) : null}
			<CardIndex suit={suit} glyph={glyph} wide={rank === "10"} color={color} />
			<g transform="rotate(180 50 70)">
				<CardIndex
					suit={suit}
					glyph={glyph}
					wide={rank === "10"}
					color={color}
				/>
			</g>
		</>
	);
}

/** Render once per screen: the shared suit shapes and card back the cards point at. */
export function CardSprite() {
	return (
		<svg
			aria-hidden="true"
			width="0"
			height="0"
			style={{ position: "absolute", width: 0, height: 0 }}
		>
			<defs>
				{(Object.keys(SUIT_PATHS) as Suit[]).map((suit) => (
					<symbol key={suit} id={`ac-suit-${suit}`} viewBox="0 0 100 100">
						<path d={SUIT_PATHS[suit]} />
					</symbol>
				))}
				<pattern
					id="ac-lattice"
					width="11"
					height="11"
					patternUnits="userSpaceOnUse"
					patternTransform="rotate(45)"
				>
					<path d="M0 0h11v11" fill="none" stroke="#d7a93f" strokeWidth=".8" />
					<circle cx="5.5" cy="5.5" r="1" fill="#d7a93f" opacity=".75" />
				</pattern>
				<symbol id="ac-card-back" viewBox="0 0 100 140">
					<rect width="100" height="140" fill="#131a3c" />
					<rect
						x="7"
						y="7"
						width="86"
						height="126"
						rx="3"
						fill="url(#ac-lattice)"
					/>
					<rect
						x="7"
						y="7"
						width="86"
						height="126"
						rx="3"
						fill="none"
						stroke="#d7a93f"
						strokeWidth="1.4"
					/>
					<rect
						x="10.5"
						y="10.5"
						width="79"
						height="119"
						rx="2"
						fill="none"
						stroke="#d7a93f"
						strokeWidth=".5"
					/>
					<path
						d="M50 44 75 70 50 96 25 70Z"
						fill="#131a3c"
						stroke="#d7a93f"
						strokeWidth="1.4"
					/>
					<path
						d="M50 50 69 70 50 90 31 70Z"
						fill="none"
						stroke="#d7a93f"
						strokeWidth=".5"
					/>
					<text
						x="50"
						y="76"
						fontSize="17"
						fontWeight="700"
						fontFamily="var(--font-display)"
						textAnchor="middle"
						fill="#e8c368"
						letterSpacing="-.5"
					>
						AC
					</text>
				</symbol>
			</defs>
		</svg>
	);
}

/** The text a screen reader hears for a card, from the current locale. */
export function useCardName() {
	const cards = useMessages().games.cards;
	return (id: CardId) => {
		const card = parseCard(id);
		if (card.joker) {
			return cards.joker;
		}
		return cards.cardName
			.replace("{rank}", cards.ranks[card.rank])
			.replace("{suit}", cards.suits[card.suit]);
	};
}

/**
 * A card drawn as SVG on `--card-w`. Null `card` is face down. The art is our
 * own: Art Deco courts and a jester, not a copy of any commercial deck.
 */
export const PlayingCard = memo(function PlayingCard({
	card,
	label,
	className,
}: {
	card: CardId | null;
	/** Omit when the surrounding control already names the card. */
	label?: string;
	className?: string;
}) {
	const glyphs = useMessages().games.cards.rankGlyphs as Record<string, string>;
	const parsed = card ? parseCard(card) : null;
	return (
		<span className={`pc ${className ?? ""}`}>
			<svg
				viewBox="0 0 100 140"
				focusable="false"
				role={label ? "img" : undefined}
				aria-label={label}
				aria-hidden={label ? undefined : true}
			>
				{parsed ? (
					<>
						<rect width="100" height="140" fill={PAPER} />
						<rect
							x="2.5"
							y="2.5"
							width="95"
							height="135"
							rx="5"
							fill="none"
							stroke="#d9cfb4"
							strokeWidth=".7"
						/>
						{parsed.joker ? (
							<JokerFace red={card !== null && cardCopy(card) % 2 === 1} />
						) : (
							<Face card={parsed} glyph={glyphs[parsed.rank] ?? parsed.rank} />
						)}
					</>
				) : (
					<use href="#ac-card-back" width="100" height="140" />
				)}
			</svg>
		</span>
	);
});

export function SuitIcon({
	suit,
	className,
}: {
	suit: Suit;
	className?: string;
}) {
	return (
		<svg
			viewBox="0 0 100 100"
			aria-hidden="true"
			focusable="false"
			className={className}
			fill="currentColor"
		>
			<path d={SUIT_PATHS[suit]} />
		</svg>
	);
}
