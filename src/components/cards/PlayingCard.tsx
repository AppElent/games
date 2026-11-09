import {
	type ArtShape,
	CARD_PAPER,
	cardBackArt,
	cardFaceArt,
	SUIT_PATHS,
	suitColor,
} from "@arcadeclub/core/cards/art";
import { type CardId, parseCard, type Suit } from "@arcadeclub/core/cards/deck";
import { cardName } from "@arcadeclub/core/cards/table-view";
import { memo } from "react";
import { useMessages } from "#/lib/i18n";

/** The class on every drawn card; measuring code finds cards by it. */
export const CARD_FACE_CLASS = "pc";

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

function Shape({ shape }: { shape: ArtShape }) {
	switch (shape.kind) {
		case "path":
			return (
				<path
					d={shape.d}
					fill={shape.fill}
					stroke={shape.stroke}
					strokeWidth={shape.strokeWidth}
					opacity={shape.opacity}
				/>
			);
		case "circle":
			return (
				<circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} />
			);
		case "rect":
			return (
				<rect
					x={shape.x}
					y={shape.y}
					width={shape.width}
					height={shape.height}
					rx={shape.rx}
					fill={shape.fill ?? "none"}
					stroke={shape.stroke}
					strokeWidth={shape.strokeWidth}
				/>
			);
		case "pip":
			return <Pip {...shape} />;
		case "text":
			return (
				<text
					x={shape.x}
					y={shape.y}
					fill={shape.fill}
					fontFamily="var(--font-display)"
					fontWeight={shape.weight}
					fontSize={shape.size}
					textAnchor="middle"
					letterSpacing={shape.spacing}
					transform={shape.transform}
				>
					{shape.value}
				</text>
			);
		case "group":
			return (
				<g transform={shape.transform}>
					<Shapes shapes={shape.shapes} />
				</g>
			);
	}
}

function Shapes({ shapes }: { shapes: readonly ArtShape[] }) {
	return shapes.map((shape, index) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: artwork never reorders.
		<Shape key={index} shape={shape} />
	));
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
				<symbol id="ac-card-back" viewBox="0 0 100 140">
					<Shapes shapes={cardBackArt()} />
				</symbol>
			</defs>
		</svg>
	);
}

/** The text a screen reader hears for a card, from the current locale. */
export function useCardName() {
	const cards = useMessages().games.cards;
	return (id: CardId) => cardName(cards, id);
}

/** A card drawn as SVG on `--card-w`. Null `card` is face down. */
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
	const glyph = parsed?.rank ? (glyphs[parsed.rank] ?? parsed.rank) : "";
	return (
		<span className={`${CARD_FACE_CLASS} ${className ?? ""}`}>
			<svg
				viewBox="0 0 100 140"
				focusable="false"
				role={label ? "img" : undefined}
				aria-label={label}
				aria-hidden={label ? undefined : true}
			>
				{card ? (
					<>
						<rect width="100" height="140" fill={CARD_PAPER} />
						<Shapes shapes={cardFaceArt(card, glyph)} />
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
