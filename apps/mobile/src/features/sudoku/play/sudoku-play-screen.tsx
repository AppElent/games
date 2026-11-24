/**
 * Opens a puzzle by id and hands it to the screen for its variant. The save
 * is resolved once (`use-opened-save.ts`); the game screens own it from
 * there, and start over when a newer board from the account replaces it.
 */
import { useRouter } from "expo-router";
import { useI18n } from "../../../i18n";
import { CenteredState } from "../../../ui/centered-state";
import { BinaryGameScreen } from "../binary/binary-game-screen";
import { SudokuGameScreen } from "../grid/sudoku-game-screen";
import { useOpenedSave } from "./use-opened-save";

export function SudokuPlayScreen({ id }: { id: string }) {
	const router = useRouter();
	const { t } = useI18n();
	const opened = useOpenedSave(id);
	if (opened.state === "loading") {
		return (
			<CenteredState loading title={t.games.sudoku.session.loadingPuzzle} />
		);
	}
	if (opened.state !== "ready") {
		return (
			<CenteredState
				title={
					opened.state === "offline"
						? t.games.sudoku.session.offline
						: t.games.sudoku.session.puzzleNotFound
				}
				action={{
					label: t.games.sudoku.game.startAnotherPuzzle,
					onPress: () => router.replace("/sudoku"),
				}}
			/>
		);
	}
	const { save } = opened;
	const version = save.cloud?.loadedUpdatedAt;
	return save.variant === "binary" ? (
		<BinaryGameScreen key={version} save={save} />
	) : (
		<SudokuGameScreen key={version} save={save} />
	);
}
