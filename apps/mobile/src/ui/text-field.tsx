/** A labelled single-line input with the app's field styling. */
import type { Ref } from "react";
import {
	StyleSheet,
	TextInput,
	type TextInputInstance,
	type TextInputProps,
	View,
} from "react-native";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	type as typeRamp,
	useThemedStyles,
	useTokens,
} from "../theme";
import { AppText } from "./text";

type Props = TextInputProps & {
	label: string;
	hint?: string;
	ref?: Ref<TextInputInstance>;
};

export function TextField({ label, hint, style, ref, ...rest }: Props) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.root}>
			<AppText variant="label">{label}</AppText>
			<TextInput
				ref={ref}
				accessibilityLabel={label}
				placeholderTextColor={tokens.textFaint}
				selectionColor={tokens.accent}
				style={[styles.input, style]}
				{...rest}
			/>
			{hint ? <AppText variant="caption">{hint}</AppText> : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { gap: spacing.xs },
		input: {
			...typeRamp.body,
			color: colors.text,
			minHeight: metrics.controlHeight,
			paddingHorizontal: spacing.lg,
			borderRadius: radius.md,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.borderStrong,
			backgroundColor: colors.surface,
		},
	});
