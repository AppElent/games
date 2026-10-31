import { useWindowDimensions } from "react-native";
import { spacing } from "../../../theme";

/** Board height per point of width (see `board-layout.ts`). */
const ASPECT = 11 / 14.2;

/**
 * How wide the board can be: the full width on a phone in portrait, and on
 * a wide screen as wide as the height allows after `reserve` points for the
 * header and controls.
 */
export function useBoardWidth(reserve: number) {
	const { width, height } = useWindowDimensions();
	const wide = width >= 700 && width > height;
	const byWidth = (wide ? width * 0.62 : width) - spacing.sm * 2;
	const byHeight = (height - reserve) / ASPECT;
	return {
		width: Math.floor(Math.max(280, Math.min(byWidth, byHeight, 720))),
		wide,
	};
}
