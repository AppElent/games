/**
 * A system symbol: SF Symbols on iOS, Material Symbols on Android. Decorative
 * by default; pass `accessibilityLabel` when the icon carries meaning alone.
 */
import { type SFSymbol, SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";

type AndroidSymbol = Extract<
	ComponentProps<typeof SymbolView>["name"],
	{ android?: unknown }
>["android"];

type Props = {
	ios: SFSymbol;
	android: NonNullable<AndroidSymbol>;
	size?: number;
	color: string;
	accessibilityLabel?: string;
};

export function Icon({
	ios,
	android,
	size = 22,
	color,
	accessibilityLabel,
}: Props) {
	return (
		<SymbolView
			name={{ ios, android, web: android }}
			size={size}
			tintColor={color}
			accessible={Boolean(accessibilityLabel)}
			accessibilityLabel={accessibilityLabel}
		/>
	);
}
