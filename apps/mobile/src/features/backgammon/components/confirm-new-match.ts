/** Asks before a new pass-and-play match replaces the one in progress. */
import { Alert } from "react-native";
import type { Messages } from "../../../i18n";

export function confirmNewMatch(t: Messages, onConfirm: () => void) {
	const copy = t.games.backgammon.newGame;
	Alert.alert(copy.confirmNewTitle, copy.confirmNewBody, [
		{ text: t.common.actions.cancel, style: "cancel" },
		{
			text: t.common.endScreen.newGame,
			style: "destructive",
			onPress: onConfirm,
		},
	]);
}
