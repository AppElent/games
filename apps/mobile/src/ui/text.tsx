/**
 * The only component allowed to set a font size. Screens pass a `variant`
 * from the type ramp; colour comes from `useTokens()` so every piece of text
 * follows the scheme. A caller's `style` still wins.
 */
import { Text, type TextProps } from "react-native";
import { type as typeRamp, useTokens } from "../theme";

export type TextVariant = keyof typeof typeRamp;
type Props = TextProps & { variant?: TextVariant; tone?: "default" | "muted" };

const MUTED: ReadonlySet<TextVariant> = new Set<TextVariant>([
	"secondary",
	"label",
	"caption",
]);

export function AppText({ variant = "body", tone, style, ...rest }: Props) {
	const tokens = useTokens();
	const muted = tone ? tone === "muted" : MUTED.has(variant);
	return (
		<Text
			style={[
				typeRamp[variant],
				{ color: muted ? tokens.textMuted : tokens.text },
				style,
			]}
			{...rest}
		/>
	);
}
