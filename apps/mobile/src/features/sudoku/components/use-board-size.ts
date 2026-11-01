import { useWindowDimensions } from "react-native";
import { metrics } from "../../../theme";

/**
 * The square board's side and whether controls sit beside it. On a phone the
 * board takes the width and leaves `reserve` points of height for the
 * controls; on a wide screen (tablet, landscape) the board takes most of the
 * height and the controls move to a side column.
 */
export function useBoardSize(reserve: number) {
	const { width, height } = useWindowDimensions();
	const wide = width >= 700 && width > height;
	if (wide) {
		return {
			size: Math.floor(Math.min(height - 140, width * 0.55, 640)),
			wide,
		};
	}
	const byWidth = width - metrics.screenGutter * 2;
	const byHeight = height - reserve;
	return {
		size: Math.floor(Math.max(260, Math.min(byWidth, byHeight, 560))),
		wide,
	};
}
