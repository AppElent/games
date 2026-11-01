/**
 * The frame around a backgammon board, the one screen in the app that turns
 * with the phone.
 *
 * Portrait scrolls the side panel under a full-width board. Landscape gives
 * the side panel its own scrolling column beside a board as tall as the
 * screen. On a phone the header goes too, since it would cost the board a
 * tenth of its height; its back and action buttons move to the top of the
 * column.
 */
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { type ReactNode, useCallback, useState } from "react";
import {
	type LayoutRectangle,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../../i18n";
import {
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { HeaderButton } from "../../../ui/button";
import { Icon } from "../../../ui/icon";
import { fitBoardWidth } from "../board/board-layout";

/** Below this height a landscape screen drops the header. */
const COMPACT_HEIGHT = 500;
const MAX_STACKED_WIDTH = 720;
const SIDE_MIN = 220;
const SIDE_MAX = 340;

type Action = { label: string; onPress: () => void; testID?: string };

export function BoardScreen({
	title,
	action,
	board,
	children,
}: {
	title: string;
	/** The screen's one header action, such as starting a new game. */
	action?: Action;
	board: (width: number) => ReactNode;
	children: ReactNode;
}) {
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const window = useWindowDimensions();
	const landscape = window.width > window.height;
	const headerShown = !landscape || window.height >= COMPACT_HEIGHT;
	const [area, setArea] = useState<LayoutRectangle | null>(null);
	useBoardRotation();

	const header = (
		<Stack.Screen
			options={{
				title,
				headerShown,
				headerRight: action ? () => <HeaderButton {...action} /> : undefined,
			}}
		/>
	);

	if (!landscape) {
		const width = Math.floor(
			Math.min(window.width - spacing.sm * 2, MAX_STACKED_WIDTH),
		);
		return (
			<>
				{header}
				<ScrollView
					style={styles.root}
					contentInsetAdjustmentBehavior="automatic"
					contentContainerStyle={[
						styles.stacked,
						{ paddingBottom: insets.bottom + spacing.lg },
					]}
				>
					{board(width)}
					<View style={[styles.side, { width }]}>{children}</View>
				</ScrollView>
			</>
		);
	}

	const padding = {
		paddingTop: (headerShown ? 0 : insets.top) + spacing.sm,
		paddingBottom: insets.bottom + spacing.sm,
		paddingLeft: insets.left + spacing.sm,
		paddingRight: insets.right + spacing.sm,
	};
	// Measured from the whole row, so resizing the column never re-measures it.
	const inner = area && {
		width: area.width - padding.paddingLeft - padding.paddingRight,
		height: area.height - padding.paddingTop - padding.paddingBottom,
	};
	const boardWidth = inner
		? fitBoardWidth(
				inner.width - SIDE_MIN - spacing.lg,
				inner.height,
				window.fontScale,
			)
		: 0;
	const sideWidth = inner
		? Math.min(SIDE_MAX, inner.width - boardWidth - spacing.lg)
		: SIDE_MIN;

	return (
		<>
			{header}
			<View
				style={[styles.root, styles.row, padding]}
				onLayout={(event) => setArea(event.nativeEvent.layout)}
			>
				<View style={styles.boardArea}>{inner ? board(boardWidth) : null}</View>
				<ScrollView
					style={{ width: sideWidth, flexGrow: 0 }}
					contentContainerStyle={styles.side}
				>
					{headerShown ? null : <ColumnHeader action={action} />}
					{children}
				</ScrollView>
			</View>
		</>
	);
}

/** Unlocks rotation while the board has focus; the app is portrait elsewhere. */
function useBoardRotation() {
	useFocusEffect(
		useCallback(() => {
			const ignore = () => {
				// Resizable windows (iPad, iPhone Mirroring) may refuse a lock.
			};
			ScreenOrientation.unlockAsync().catch(ignore);
			return () => {
				ScreenOrientation.lockAsync(
					ScreenOrientation.OrientationLock.PORTRAIT_UP,
				).catch(ignore);
			};
		}, []),
	);
}

/** Back and the header action, for a landscape phone without a header. */
function ColumnHeader({ action }: { action?: Action }) {
	const { t } = useI18n();
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	return (
		<View style={styles.columnHeader}>
			<HeaderButton
				label={t.common.actions.back}
				icon={
					<Icon
						ios="chevron.left"
						android="arrow_back"
						size={17}
						color={tokens.accent}
					/>
				}
				onPress={() => router.back()}
				testID="bg-back"
			/>
			{action ? <HeaderButton {...action} /> : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		stacked: {
			alignItems: "center",
			gap: spacing.lg,
			paddingHorizontal: spacing.sm,
			paddingTop: spacing.sm,
		},
		row: { flexDirection: "row", gap: spacing.lg },
		/** Takes the room the column leaves; the board centres in it. */
		boardArea: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
		},
		side: { gap: spacing.lg, paddingBottom: spacing.sm },
		columnHeader: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
		},
	});
