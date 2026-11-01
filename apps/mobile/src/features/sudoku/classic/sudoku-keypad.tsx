/**
 * Entry mode, the nine digits (or eight marker colours in colour mode), and
 * the edit actions. Digits show how many are still to place; a finished
 * digit dims but stays pressable so it can be toggled off again.
 */
import type { SudokuInputMode } from "@arcadeclub/core/sudoku-board";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	markerColors,
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Icon } from "../../../ui/icon";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";

const MODES: readonly SudokuInputMode[] = [
	"digit",
	"corner",
	"center",
	"color",
];
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type Props = {
	mode: SudokuInputMode;
	onModeChange: (mode: SudokuInputMode) => void;
	onDigit: (digit: number) => void;
	onColor: (color: number) => void;
	onErase: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onHint: () => void;
	canUndo: boolean;
	canRedo: boolean;
	/** Placed count per digit, index 1–9. */
	digitCounts: number[];
	disabled: boolean;
};

export function SudokuKeypad({
	mode,
	onModeChange,
	onDigit,
	onColor,
	onErase,
	onUndo,
	onRedo,
	onHint,
	canUndo,
	canRedo,
	digitCounts,
	disabled,
}: Props) {
	const { t } = useI18n();
	const copy = t.games.sudoku.keypad;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const modeLabels: Record<SudokuInputMode, string> = {
		digit: copy.modeDigit,
		corner: copy.modeCorner,
		center: copy.modeCenter,
		color: copy.modeColor,
	};

	return (
		<View style={styles.root} pointerEvents={disabled ? "none" : "auto"}>
			<Segmented
				accessibilityLabel={copy.modeLabel}
				options={MODES.map((value) => ({ value, label: modeLabels[value] }))}
				value={mode}
				onChange={onModeChange}
				testID="sudoku-mode"
			/>
			<View style={styles.keys}>
				{mode === "color"
					? markerColors.map((color, index) => (
							<Pressable
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed palette
								key={index}
								accessibilityRole="button"
								accessibilityLabel={fmt(copy.colorAriaLabel, {
									number: index + 1,
								})}
								onPress={() => onColor(index + 1)}
								style={({ pressed }) => [styles.key, pressed && styles.pressed]}
							>
								<View style={[styles.swatch, { backgroundColor: color }]} />
							</Pressable>
						))
					: DIGITS.map((digit) => {
							const left = Math.max(0, 9 - (digitCounts[digit] ?? 0));
							return (
								<Pressable
									key={digit}
									accessibilityRole="button"
									accessibilityLabel={fmt(copy.digitLabel, {
										digit,
										count: left,
									})}
									onPress={() => onDigit(digit)}
									style={({ pressed }) => [
										styles.key,
										pressed && styles.pressed,
										left === 0 && mode === "digit" && styles.done,
									]}
									testID={`sudoku-key-${digit}`}
								>
									<AppText
										variant="keypad"
										allowFontScaling={false}
										style={{
											color: mode === "digit" ? tokens.text : tokens.accent,
										}}
									>
										{digit}
									</AppText>
									{mode === "digit" ? (
										<AppText variant="caption" allowFontScaling={false}>
											{left}
										</AppText>
									) : null}
								</Pressable>
							);
						})}
			</View>
			<View style={styles.actions}>
				<Action
					icon={["arrow.uturn.backward", "undo"]}
					label={copy.undo}
					onPress={onUndo}
					disabled={!canUndo}
				/>
				<Action
					icon={["arrow.uturn.forward", "redo"]}
					label={copy.redo}
					onPress={onRedo}
					disabled={!canRedo}
				/>
				<Action
					icon={["delete.left", "backspace"]}
					label={copy.erase}
					onPress={onErase}
				/>
				<Action
					icon={["lightbulb", "lightbulb"]}
					label={copy.hint}
					onPress={onHint}
					testID="sudoku-hint"
				/>
			</View>
		</View>
	);
}

function Action({
	icon,
	label,
	onPress,
	disabled = false,
	testID,
}: {
	icon: [
		Parameters<typeof Icon>[0]["ios"],
		Parameters<typeof Icon>[0]["android"],
	];
	label: string;
	onPress: () => void;
	disabled?: boolean;
	testID?: string;
}) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			testID={testID}
			style={({ pressed }) => [
				styles.action,
				pressed && styles.pressed,
				disabled && styles.disabled,
			]}
		>
			<Icon ios={icon[0]} android={icon[1]} size={22} color={tokens.accent} />
			{/* Two lines so longer labels ("Ongedaan maken") wrap instead of truncating. */}
			<AppText variant="caption" numberOfLines={2} style={styles.actionLabel}>
				{label}
			</AppText>
		</Pressable>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { gap: spacing.md },
		keys: { flexDirection: "row", gap: spacing.xs },
		key: {
			flex: 1,
			minHeight: 56,
			borderRadius: radius.sm,
			backgroundColor: colors.surface,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.border,
			alignItems: "center",
			justifyContent: "center",
		},
		swatch: {
			width: 24,
			height: 24,
			borderRadius: radius.pill,
		},
		done: { opacity: 0.35 },
		actions: { flexDirection: "row", gap: spacing.xs },
		action: {
			flex: 1,
			minHeight: 52,
			alignItems: "center",
			// Top-aligned so icons stay level when one label wraps.
			justifyContent: "flex-start",
			gap: spacing.xxs,
			borderRadius: radius.sm,
		},
		actionLabel: { textAlign: "center" },
		pressed: {
			backgroundColor: colors.surfacePressed,
			opacity: opacity.pressed,
		},
		disabled: { opacity: opacity.disabled },
	});
