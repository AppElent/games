/**
 * The app is portrait everywhere; only the backgammon board unlocks
 * rotation while it has focus. Resizable windows (iPad, iPhone Mirroring)
 * may refuse either call, which changes nothing.
 */
import * as ScreenOrientation from "expo-screen-orientation";
import { bestEffort } from "../observability/report";

export function lockPortrait() {
	bestEffort(
		ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP),
	);
}

export function unlockRotation() {
	bestEffort(ScreenOrientation.unlockAsync());
}
