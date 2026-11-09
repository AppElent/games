/**
 * A system symbol: SF Symbols on iOS, Material Symbols on Android. Always
 * decorative: the control or text beside it carries the meaning.
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
};

export function Icon({ ios, android, size = 22, color }: Props) {
	return (
		<SymbolView
			name={{ ios, android }}
			size={size}
			tintColor={color}
			accessible={false}
		/>
	);
}
