/**
 * The current roll as dice faces. Spent dice fade out but stay in place,
 * so a player can see which values are left.
 */
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	backgammonColors as board,
	opacity,
	radius,
	spacing,
} from "../../../theme";

const PIPS: Record<number, number[]> = {
	1: [4],
	2: [0, 8],
	3: [0, 4, 8],
	4: [0, 2, 6, 8],
	5: [0, 2, 4, 6, 8],
	6: [0, 2, 3, 5, 6, 8],
};
const GRID = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const SLOTS = [0, 1, 2, 3];

export function DiceRow({
	dice,
	used,
	size = 36,
}: {
	dice: number[];
	used: boolean[];
	size?: number;
}) {
	const { t } = useI18n();
	const copy = t.backgammon.board;
	if (dice.length === 0) return null;
	const label = fmt(copy.dice, {
		dice: dice
			.map((value, index) =>
				used[index] ? `${value} (${copy.diceUsed})` : value,
			)
			.join(", "),
	});
	return (
		<View
			style={styles.row}
			accessible
			accessibilityRole="text"
			accessibilityLabel={label}
			testID="bg-dice"
		>
			{SLOTS.slice(0, dice.length).map((index) => (
				<Die key={index} value={dice[index]} spent={used[index]} size={size} />
			))}
		</View>
	);
}

function Die({
	value,
	spent,
	size,
}: {
	value: number;
	spent: boolean;
	size: number;
}) {
	const pips = PIPS[value] ?? [];
	const pip = size * 0.18;
	return (
		<View
			style={[
				styles.die,
				{ width: size, height: size, padding: size * 0.12 },
				spent && styles.spent,
			]}
		>
			{GRID.map((cell) => (
				<View key={cell} style={styles.cell}>
					{pips.includes(cell) ? (
						<View
							style={{
								width: pip,
								height: pip,
								borderRadius: pip / 2,
								backgroundColor: board.pip,
							}}
						/>
					) : null}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
	die: {
		flexDirection: "row",
		flexWrap: "wrap",
		borderRadius: radius.sm,
		backgroundColor: board.die,
		borderWidth: 1,
		borderColor: board.dieEdge,
	},
	cell: {
		width: "33.333%",
		height: "33.333%",
		alignItems: "center",
		justifyContent: "center",
	},
	spent: { opacity: opacity.disabled },
});
