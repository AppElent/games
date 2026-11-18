/** The controls every table game's setup shares: sections, opponents, house rules. */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { haptics } from "../../feedback/haptics";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../theme";
import { Card } from "../../ui/card";
import { Icon } from "../../ui/icon";
import { AppText } from "../../ui/text";

export function SetupSection({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.section}>
			<AppText variant="label" accessibilityRole="header">
				{label.toUpperCase()}
			</AppText>
			{children}
		</View>
	);
}

/** How many computer players join a game against the computer. */
export function OpponentStepper({
	testPrefix,
	...props
}: Omit<StepperProps, "testID"> & { testPrefix: string }) {
	return <CountStepper {...props} testID={`${testPrefix}-opponents`} />;
}

type StepperProps = {
	value: number;
	min: number;
	max: number;
	/** The count in words, such as "3 opponents". */
	label: string;
	fewer: string;
	more: string;
	onChange: (value: number) => void;
	/** Prefix of the two buttons' ids, which end in `-fewer` and `-more`. */
	testID: string;
};

/** A count between `min` and `max`, one step at a time. */
export function CountStepper({
	value,
	min,
	max,
	label,
	fewer,
	more,
	onChange,
	testID,
}: StepperProps) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const step = (delta: number, stepLabel: string, disabled: boolean) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={stepLabel}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={() => {
				haptics.selectionChanged();
				onChange(value + delta);
			}}
			testID={`${testID}-${delta > 0 ? "more" : "fewer"}`}
			style={[styles.step, disabled && styles.stepDisabled]}
		>
			<Icon
				ios={delta > 0 ? "plus" : "minus"}
				android={delta > 0 ? "add" : "remove"}
				size={18}
				color={tokens.accent}
			/>
		</Pressable>
	);
	return (
		<View style={styles.stepper}>
			{step(-1, fewer, value <= min)}
			<AppText
				variant="body"
				accessibilityLiveRegion="polite"
				style={styles.count}
			>
				{label}
			</AppText>
			{step(1, more, value >= max)}
		</View>
	);
}

/** One switch row: a rule's name and what it does. */
export function RuleSwitch({
	label,
	hint,
	value,
	disabled,
	onChange,
	leading,
	testID,
}: {
	label: string;
	hint: string;
	value: boolean;
	disabled?: boolean;
	onChange: (on: boolean) => void;
	/** A picture before the text, hidden from screen readers. */
	leading?: ReactNode;
	testID: string;
}) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.rule}>
			{leading ? (
				<View
					accessible={false}
					importantForAccessibility="no-hide-descendants"
					accessibilityElementsHidden
				>
					{leading}
				</View>
			) : null}
			<View style={styles.ruleText}>
				<AppText variant="body">{label}</AppText>
				<AppText variant="caption">{hint}</AppText>
			</View>
			<Switch
				accessibilityLabel={label}
				accessibilityHint={hint}
				value={value}
				disabled={disabled}
				trackColor={{ true: tokens.accent }}
				onValueChange={onChange}
				testID={testID}
			/>
		</View>
	);
}

/** A game's house rules as switches; a disabled one reads off whatever was chosen. */
export function HouseRuleSwitches({
	heading,
	rules,
	chosen,
	onChange,
	testPrefix,
}: {
	heading: string;
	rules: ReadonlyArray<{
		id: string;
		label: string;
		hint: string;
		disabled?: boolean;
	}>;
	chosen: readonly string[];
	onChange: (id: string, on: boolean) => void;
	testPrefix: string;
}) {
	if (rules.length === 0) return null;
	return (
		<SetupSection label={heading}>
			<Card>
				{rules.map((rule) => (
					<RuleSwitch
						key={rule.id}
						label={rule.label}
						hint={rule.hint}
						value={!rule.disabled && chosen.includes(rule.id)}
						disabled={rule.disabled}
						onChange={(on) => onChange(rule.id, on)}
						testID={`${testPrefix}-option-${rule.id}`}
					/>
				))}
			</Card>
		</SetupSection>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		section: { gap: spacing.sm },
		stepper: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			padding: spacing.xs,
			borderRadius: radius.md,
			backgroundColor: colors.surface2,
		},
		step: {
			width: metrics.hitTarget,
			height: metrics.hitTarget,
			borderRadius: radius.sm,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface,
		},
		stepDisabled: { opacity: 0.45 },
		count: { flex: 1, textAlign: "center" },
		rule: {
			minHeight: metrics.hitTarget,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
		},
		ruleText: { flex: 1, gap: spacing.xxs },
	});
