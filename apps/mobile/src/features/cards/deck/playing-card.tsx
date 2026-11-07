/**
 * A card drawn from the shared artwork, so the app's deck is the web's deck.
 * `null` is face down. Memoized: a table holds dozens and most never change.
 */
import {
	type ArtShape,
	CARD_ASPECT,
	CARD_PAPER,
	cardBackArt,
	cardFaceArt,
	SUIT_PATHS,
	suitColor,
} from "@arcadeclub/core/cards/art";
import { type CardId, parseCard, type Suit } from "@arcadeclub/core/cards/deck";
import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { useI18n } from "../../../i18n";
import { cardColors } from "../../../theme";

function Shape({ shape }: { shape: ArtShape }) {
	switch (shape.kind) {
		case "path":
			return (
				<Path
					d={shape.d}
					fill={shape.fill}
					stroke={shape.stroke}
					strokeWidth={shape.strokeWidth}
					opacity={shape.opacity}
				/>
			);
		case "circle":
			return (
				<Circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} />
			);
		case "rect":
			return (
				<Rect
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
			return (
				<Path
					d={SUIT_PATHS[shape.suit]}
					fill={suitColor(shape.suit)}
					transform={`${shape.flip ? `rotate(180 ${shape.x} ${shape.y}) ` : ""}translate(${shape.x - shape.size / 2} ${shape.y - shape.size / 2}) scale(${shape.size / 100})`}
				/>
			);
		case "text":
			return (
				<SvgText
					x={shape.x}
					y={shape.y}
					fill={shape.fill}
					fontWeight={shape.weight}
					fontSize={shape.size}
					textAnchor="middle"
					letterSpacing={shape.spacing}
					transform={shape.transform}
				>
					{shape.value}
				</SvgText>
			);
		case "group":
			return (
				<G transform={shape.transform}>
					<Shapes shapes={shape.shapes} />
				</G>
			);
	}
}

function Shapes({ shapes }: { shapes: readonly ArtShape[] }) {
	return shapes.map((shape, index) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: artwork never reorders.
		<Shape key={index} shape={shape} />
	));
}

export const PlayingCard = memo(function PlayingCard({
	card,
	width,
}: {
	card: CardId | null;
	width: number;
}) {
	const { t } = useI18n();
	const glyphs = t.games.cards.rankGlyphs as Record<string, string>;
	const parsed = card ? parseCard(card) : null;
	const rank = parsed && !parsed.joker ? parsed.rank : "";
	const glyph = glyphs[rank] ?? rank;
	const shapes = useMemo(
		() => (card ? cardFaceArt(card, glyph) : cardBackArt()),
		[card, glyph],
	);
	const height = width * CARD_ASPECT;
	const borderRadius = width * 0.075;
	return (
		<View
			style={[
				styles.card,
				{
					width,
					height,
					borderRadius,
					backgroundColor: card ? CARD_PAPER : cardColors.cardBack,
				},
			]}
		>
			<View style={[styles.clip, { borderRadius }]}>
				<Svg width={width} height={height} viewBox="0 0 100 140">
					<Shapes shapes={shapes} />
				</Svg>
			</View>
		</View>
	);
});

export function SuitIcon({
	suit,
	size,
	color,
}: {
	suit: Suit;
	size: number;
	color?: string;
}) {
	return (
		<Svg width={size} height={size} viewBox="0 0 100 100">
			<Path d={SUIT_PATHS[suit]} fill={color ?? suitColor(suit)} />
		</Svg>
	);
}

const styles = StyleSheet.create({
	card: {
		shadowColor: cardColors.shadow,
		shadowOpacity: 0.32,
		shadowRadius: 3,
		shadowOffset: { width: 0, height: 1.5 },
		elevation: 2,
	},
	clip: { flex: 1, overflow: "hidden" },
});
