/** The table's cloth, lit from above with the edges falling away into shadow. */
import type { FeltColor } from "@arcadeclub/core/cards/engine";
import { StyleSheet, View } from "react-native";
import { cardColors } from "../../../theme";

export function Felt({ felt }: { felt: FeltColor }) {
	const [light, mid, dark] = cardColors.felts[felt];
	return (
		<View
			pointerEvents="none"
			style={[
				StyleSheet.absoluteFill,
				{
					backgroundColor: dark,
					backgroundImage: `radial-gradient(85% 62% at 50% 42%, ${light} 0%, ${mid} 55%, ${dark} 100%)`,
				},
			]}
		/>
	);
}
