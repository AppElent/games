/**
 * A stand-in for react-native-reanimated and -worklets in render tests: values
 * apply at once and nothing animates. Use it with `jest.mock` in the test file,
 * since the library's own mock still wants its native side.
 */
import { View } from "react-native";

const instant = <T>(value: T) => value;

export const reanimatedMock = {
	__esModule: true,
	default: { View },
	useSharedValue: <T>(value: T) => ({ value }),
	useAnimatedStyle: (style: () => object) => style(),
	useReducedMotion: () => true,
	withTiming: instant,
	withSpring: instant,
	withDelay: (_delay: number, value: unknown) => value,
	withRepeat: instant,
	withSequence: (...values: unknown[]) => values.at(-1),
	cancelAnimation: () => {},
	interpolate: (_value: number, _input: number[], output: number[]) =>
		output[0],
	Easing: { bezier: () => () => 0, out: instant, cubic: () => 0 },
	FadeIn: {},
	FadeOut: {},
};

export const workletsMock = {
	scheduleOnRN: (run: (...args: unknown[]) => void, ...args: unknown[]) =>
		run(...args),
};
