/**
 * The screen around any puzzle in play: the native header with pause, the
 * clock and status line, the board under its paused cover, and the
 * variant's controls, either under the board (`below`) or in their own
 * column (`beside`), which sits to the right on a wide screen.
 */
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { metrics, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { PausedOverlay } from "./paused-overlay";
import { PuzzleHeader } from "./puzzle-header";
import { PuzzleStatus } from "./puzzle-status";
import type { SudokuStatus } from "./puzzle-types";

/** The width of the controls column beside the board on a wide screen. */
const SIDE_COLUMN_WIDTH = 360;

type Props = {
	title: string;
	session: {
		status: SudokuStatus;
		elapsed: number;
		pause: () => void;
		resume: () => void;
	};
	detail?: string;
	/** The board's side, in points. */
	size: number;
	wide?: boolean;
	/** Space between the rows of the board column. */
	gap: number;
	board: ReactNode;
	below?: ReactNode;
	beside?: ReactNode;
};

export function PuzzleFrame({
	title,
	session,
	detail,
	size,
	wide = false,
	gap,
	board,
	below,
	beside,
}: Props) {
	const router = useRouter();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const { status } = session;
	return (
		<>
			<PuzzleHeader
				title={title}
				status={status}
				onPause={session.pause}
				onResume={session.resume}
			/>
			<ScrollView
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={[
					styles.content,
					wide && styles.wideContent,
					{ paddingBottom: insets.bottom + spacing.lg },
				]}
			>
				<View style={{ width: size, gap }}>
					<PuzzleStatus
						status={status}
						elapsed={session.elapsed}
						detail={detail}
						onNewPuzzle={() => router.back()}
					/>
					<View>
						{board}
						{status === "paused" ? (
							<PausedOverlay onResume={session.resume} />
						) : null}
					</View>
					{below}
				</View>
				{beside ? (
					<View style={{ width: wide ? SIDE_COLUMN_WIDTH : size }}>
						{beside}
					</View>
				) : null}
			</ScrollView>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			alignItems: "center",
			gap: spacing.lg,
			paddingHorizontal: metrics.screenGutter,
			paddingTop: spacing.sm,
		},
		wideContent: {
			flexDirection: "row",
			alignItems: "flex-start",
			justifyContent: "center",
		},
	});
