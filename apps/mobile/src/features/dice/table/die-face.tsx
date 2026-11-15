/** One die face, drawn; whoever places it names it for screen readers. */
import { StyleSheet, View } from "react-native";
import { cardColors } from "../../../theme";

/** Which cells of a 3x3 grid hold a pip, per face. */
const PIPS: Record<number, readonly number[]> = {
	1: [4],
	2: [0, 8],
	3: [0, 4, 8],
	4: [0, 2, 6, 8],
	5: [0, 2, 4, 6, 8],
	6: [0, 2, 3, 5, 6, 8],
};
const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function DieFace({
	value,
	size,
	held = false,
	ring,
}: {
	value: number;
	size: number;
	held?: boolean;
	/** The held outline's colour. */
	ring?: string;
}) {
	const pips = PIPS[value] ?? [];
	const pip = size * 0.18;
	return (
		<View
			accessible={false}
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			style={[
				styles.body,
				{
					width: size,
					height: size,
					borderRadius: size * 0.2,
					padding: size * 0.12,
					borderWidth: held ? 3 : StyleSheet.hairlineWidth,
					borderColor: held && ring ? ring : "rgba(0, 0, 0, 0.25)",
				},
			]}
		>
			{CELLS.map((cell) => (
				<View key={cell} style={styles.cell}>
					{pips.includes(cell) ? (
						<View
							style={[
								styles.pip,
								{ width: pip, height: pip, borderRadius: pip / 2 },
							]}
						/>
					) : null}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	body: {
		flexDirection: "row",
		flexWrap: "wrap",
		backgroundColor: cardColors.ivory,
	},
	cell: {
		width: "33.333%",
		height: "33.333%",
		alignItems: "center",
		justifyContent: "center",
	},
	pip: { backgroundColor: "#1b1310" },
});
