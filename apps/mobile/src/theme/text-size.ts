import { useWindowDimensions } from "react-native";

/**
 * The system text multiplier from which side-by-side rows stack instead:
 * iOS's first accessibility size, and past Android's largest standard step.
 */
const ACCESSIBILITY_TEXT_SCALE = 1.5;

/** True at accessibility text sizes, where horizontal rows should stack (HIG). */
export function useAccessibilityTextSize(): boolean {
	return useWindowDimensions().fontScale >= ACCESSIBILITY_TEXT_SCALE;
}
