/** Clears the player's entries after a confirmation that names what is lost. */
import { Alert } from "react-native";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";

export function PuzzleRestartButton({
	body,
	onRestart,
	disabled,
}: {
	/** What restarting clears, for this variant. */
	body: string;
	onRestart: () => void;
	disabled?: boolean;
}) {
	const { t } = useI18n();
	const confirm = () =>
		Alert.alert(t.games.sudoku.game.restartTitle, body, [
			{ text: t.common.actions.cancel, style: "cancel" },
			{
				text: t.common.gameShell.restart,
				style: "destructive",
				onPress: onRestart,
			},
		]);
	return (
		<Button
			variant="plain"
			compact
			label={t.common.gameShell.restart}
			onPress={confirm}
			disabled={disabled}
		/>
	);
}
