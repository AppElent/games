/**
 * The room menu as a native page sheet. Opening it never stops the clock;
 * only the host's Pause for everyone does. End game and Leave room confirm
 * with a native alert first.
 */
import { scoreLine } from "@arcadeclub/core/beat-the-clock-view";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	Alert,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt } from "../../../i18n";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { Button, HeaderButton } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { forgetSeat } from "../../sessions/session-seats";
import { type ClockScreenProps, useClockCopy } from "./clock-bits";
import { liveTurn, teamAfterSkip } from "./room-text";

type Panel = "menu" | "howTo" | "switch";

export function ClockMenu(
	props: ClockScreenProps & { open: boolean; onClose: () => void },
) {
	const { bundle, view, room, open, onClose } = props;
	const s = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const { copy, teams } = useClockCopy();
	const { state, session } = bundle;
	const [panel, setPanel] = useState<Panel>("menu");
	const code = session.joinCode ?? "";
	const lobby = state.phase === "lobby";
	const finished = state.phase === "finished";
	const live = liveTurn(state);
	const nextAfterSkip = teamAfterSkip(state, view);

	const close = () => {
		setPanel("menu");
		onClose();
	};
	const closeIf = (ok: boolean) => {
		if (ok) close();
	};

	const confirmEnd = () =>
		Alert.alert(
			copy.end.title,
			fmt(
				live && state.phase !== "ready"
					? copy.end.body
					: copy.end.bodyBetweenTurns,
				{
					scores: scoreLine(state.scores, copy.teams),
				},
			),
			[
				{ text: copy.end.cancel, style: "cancel" },
				{
					text: copy.end.confirm,
					style: "destructive",
					onPress: async () => closeIf(await room.end()),
				},
			],
		);

	const confirmLeave = () =>
		Alert.alert(copy.leave.title, fmt(copy.leave.body, { code }), [
			{ text: copy.leave.cancel, style: "cancel" },
			{
				text: copy.leave.confirm,
				style: "destructive",
				onPress: async () => {
					if (await room.leave()) {
						close();
						forgetSeat(session._id);
						router.replace("/");
					}
				},
			},
		]);

	const title =
		panel === "howTo"
			? copy.menu.howToPlay
			: panel === "switch"
				? copy.menu.switch
				: view.isHost
					? copy.menu.hostTitle
					: copy.menu.title;

	return (
		<Modal
			visible={open}
			presentationStyle="pageSheet"
			animationType="slide"
			allowSwipeDismissal
			onRequestClose={close}
		>
			<View style={s.root}>
				<View style={s.header}>
					<AppText variant="heading" accessibilityRole="header" style={s.flex}>
						{title}
					</AppText>
					<HeaderButton
						label={copy.menu.close}
						onPress={close}
						testID="clock-menu-close"
					/>
				</View>
				<ScrollView
					contentContainerStyle={[
						s.content,
						{ paddingBottom: insets.bottom + spacing.xxl },
					]}
				>
					{panel === "howTo" ? (
						copy.howTo.map((step, index) => (
							<AppText key={step} variant="body">
								{`${index + 1}. ${step}`}
							</AppText>
						))
					) : panel === "switch" ? (
						Array.from({ length: state.teamCount }, (_, team) => team)
							.filter((team) => team !== (view.myPendingTeam ?? view.myTeam))
							.map((team) => (
								<Button
									key={team}
									variant="secondary"
									label={fmt(copy.lobby.join, { team: teams.team(team) })}
									busy={room.pending === `team-${team}`}
									onPress={async () => closeIf(await room.pickTeam(team))}
								/>
							))
					) : (
						<>
							{view.isHost && !lobby && !finished ? (
								<Item
									label={state.paused ? copy.menu.resume : copy.menu.pause}
									hint={
										state.paused ? copy.menu.resumeHint : copy.menu.pauseHint
									}
									onPress={async () =>
										closeIf(await (state.paused ? room.resume() : room.pause()))
									}
								/>
							) : null}
							{view.isHost && nextAfterSkip !== undefined ? (
								<Item
									label={copy.menu.skip}
									hint={fmt(copy.menu.skipHint, {
										team: teams.team(nextAfterSkip),
									})}
									onPress={async () => closeIf(await room.skip())}
								/>
							) : null}
							<Item
								label={copy.menu.howToPlay}
								onPress={() => setPanel("howTo")}
							/>
							{!view.isHost &&
							!view.isWatcher &&
							!lobby &&
							!finished &&
							view.myTeam !== undefined &&
							!(live && view.role === "describer") ? (
								<Item
									label={copy.menu.switch}
									hint={
										view.switchBlocked
											? copy.menu.switchBlocked
											: copy.menu.switchHint
									}
									disabled={view.switchBlocked}
									onPress={() => setPanel("switch")}
								/>
							) : null}
							{view.isHost && !lobby && !finished ? (
								<Item
									label={copy.menu.end}
									hint={copy.menu.endHint}
									danger
									onPress={confirmEnd}
								/>
							) : null}
							{!view.isHost && !finished ? (
								<Item
									label={copy.menu.leave}
									hint={fmt(copy.menu.leaveHint, { code })}
									danger
									onPress={confirmLeave}
								/>
							) : null}
						</>
					)}
				</ScrollView>
			</View>
		</Modal>
	);
}

function Item({
	label,
	hint,
	danger = false,
	disabled = false,
	onPress,
}: {
	label: string;
	hint?: string;
	danger?: boolean;
	disabled?: boolean;
	onPress: () => void;
}) {
	const s = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={hint}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				s.item,
				pressed && s.pressed,
				disabled && { opacity: opacity.disabled },
			]}
		>
			<AppText variant="control" style={danger ? s.danger : undefined}>
				{label}
			</AppText>
			{hint ? <AppText variant="caption">{hint}</AppText> : null}
		</Pressable>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		header: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: spacing.xl,
			paddingTop: spacing.lg,
			paddingBottom: spacing.sm,
		},
		flex: { flex: 1 },
		content: { paddingHorizontal: spacing.xl, gap: spacing.sm },
		item: {
			minHeight: 56,
			justifyContent: "center",
			gap: spacing.xxs,
			borderRadius: radius.md,
			backgroundColor: colors.surface,
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.sm,
		},
		pressed: { backgroundColor: colors.surfacePressed },
		danger: { color: colors.danger },
	});
