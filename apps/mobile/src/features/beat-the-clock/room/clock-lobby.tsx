/**
 * The lobby and the late-join picker. Everyone, the host included, picks a
 * team by tapping its card; the host shares the code and starts the game.
 */
import { lobbyReady } from "@arcadeclub/core/beat-the-clock";
import { Pressable, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import { InviteQr } from "../../sessions/host/invite-qr";
import { shareInvite } from "../../sessions/host/share-invite";
import { webJoinUrl } from "../../sessions/session-links";
import { type ClockScreenProps, TeamChip, useClockCopy } from "./clock-bits";

export function ClockLobby(props: ClockScreenProps) {
	const { bundle, view, room } = props;
	const { t, locale, copy, teams } = useClockCopy();
	const { state, session } = bundle;
	const hostName = view.name(session.hostParticipantId);
	const ready = lobbyReady(
		{ ...state, deck: [], used: [], turn: undefined },
		view.players.map((p) => p._id),
	);
	const alone = view.players.length <= 1 && view.isHost;
	const myTeam = view.myTeam;
	const code = session.joinCode;

	return (
		<>
			{view.isHost ? (
				code ? (
					<Card>
						<View style={styles.center}>
							<AppText variant="label">
								{copy.lobby.roomCodeLabel.toUpperCase()}
							</AppText>
							<AppText variant="code" selectable testID="clock-room-code">
								{code}
							</AppText>
							<InviteQr value={webJoinUrl({ code }) ?? code} size={160} />
							<Button
								variant="secondary"
								label={copy.lobby.share}
								onPress={() => void shareInvite(t, copy.title, { code })}
								testID="clock-share"
							/>
						</View>
					</Card>
				) : null
			) : (
				<View style={styles.gap}>
					<AppText variant="title" accessibilityRole="header">
						{view.isWatcher
							? copy.lobby.title
							: myTeam === undefined
								? copy.lobby.pickTitle
								: fmt(copy.lobby.onTeamTitle, { team: teams.team(myTeam) })}
					</AppText>
					<AppText variant="secondary">
						{view.isWatcher
							? copy.lobby.watching
							: myTeam === undefined
								? copy.lobby.pickBody
								: fmt(copy.lobby.onTeamBody, { host: hostName })}
					</AppText>
				</View>
			)}

			{alone ? (
				<Card>
					<View style={styles.center}>
						<AppText variant="heading">{copy.lobby.emptyTitle}</AppText>
						<AppText variant="secondary" style={styles.centerText}>
							{copy.lobby.emptyBody}
						</AppText>
					</View>
				</Card>
			) : (
				<TeamCards {...props} />
			)}

			{view.unassigned.length > 0 ? (
				<AppText variant="secondary">
					{fmt(copy.lobby.noTeam, {
						names: teams.names(view.unassigned.map((p) => p.displayName)),
					})}
				</AppText>
			) : null}

			{view.isHost ? (
				<>
					{alone ? null : (
						<Button
							variant="secondary"
							label={copy.lobby.shuffle}
							busy={room.pending === "shuffle"}
							onPress={() => void room.shuffleTeams()}
							testID="clock-shuffle"
						/>
					)}
					{ready ? null : (
						<AppText variant="caption" style={styles.centerText}>
							{copy.lobby.need}
						</AppText>
					)}
					<Button
						label={copy.lobby.start}
						disabled={!ready}
						busy={room.pending === "start"}
						onPress={() => void room.start()}
						testID="clock-start"
					/>
				</>
			) : (
				<AppText
					variant="secondary"
					style={styles.centerText}
					accessibilityLiveRegion="polite"
				>
					{myTeam === undefined && !view.isWatcher
						? copy.lobby.statusPick
						: fmt(copy.lobby.statusWaiting, { host: hostName })}
				</AppText>
			)}
			<AppText variant="caption" style={styles.centerText}>
				{plural(locale, view.players.length, copy.lobby.teamCount)}
			</AppText>
		</>
	);
}

/** A player joining a game in progress: pick a team, play from its next turn. */
export function ClockLate(props: ClockScreenProps) {
	const { bundle, view } = props;
	const { copy, teams } = useClockCopy();
	const picked = view.myPendingTeam ?? view.myTeam;
	return (
		<>
			<View style={styles.gap}>
				<AppText variant="title" accessibilityRole="header">
					{copy.lobby.lateTitle}
				</AppText>
				<AppText variant="secondary">
					{picked === undefined
						? fmt(copy.lobby.lateBody, { turn: bundle.state.turnNumber })
						: copy.lobby.lateOnTeamBody}
				</AppText>
			</View>
			<TeamCards {...props} />
			<AppText
				variant="secondary"
				style={styles.centerText}
				accessibilityLiveRegion="polite"
			>
				{picked === undefined
					? copy.lobby.statusPick
					: fmt(copy.lobby.statusLate, {
							team: teams.team(bundle.state.turn?.team ?? 0),
						})}
			</AppText>
		</>
	);
}

function TeamCards({ bundle, view, room }: ClockScreenProps) {
	const s = useThemedStyles(createStyles);
	const { locale, copy, teams } = useClockCopy();
	const { state } = bundle;
	const mine = view.myPendingTeam ?? view.myTeam;
	const canPick = !view.isWatcher;
	return (
		<View style={s.grid}>
			{Array.from({ length: state.teamCount }, (_, team) => team).map(
				(team) => {
					const ids = [
						...view.teamMembers(team),
						...state.pending
							.filter((p) => p.team === team)
							.map((p) => p.participantId),
					];
					const selected = mine === team;
					const names = ids.map((id) =>
						id === bundle.viewerId
							? fmt(copy.lobby.you, { name: view.name(id) })
							: view.name(id),
					);
					return (
						<Pressable
							key={team}
							accessibilityRole="button"
							accessibilityState={{
								selected,
								disabled: !canPick || room.pending !== null,
							}}
							accessibilityLabel={`${teams.team(team)}, ${plural(locale, ids.length, copy.lobby.teamCount)}${names.length ? `: ${names.join(", ")}` : ""}`}
							disabled={!canPick || room.pending !== null}
							onPress={() => {
								if (selected) return;
								haptics.selectionChanged();
								void room.pickTeam(team);
							}}
							style={[s.team, selected && s.teamSelected]}
							testID={`clock-team-${team}`}
						>
							<View style={s.teamHead}>
								<TeamChip label={teams.team(team)} />
								<AppText variant="caption">
									{plural(locale, ids.length, copy.lobby.teamCount)}
								</AppText>
							</View>
							{names.map((name, index) => (
								<AppText key={ids[index]} variant="body">
									{name}
								</AppText>
							))}
							{canPick && !selected ? (
								<AppText variant="control" style={s.join}>
									{room.pending === `team-${team}`
										? "…"
										: mine === undefined
											? fmt(copy.lobby.join, { team: teams.team(team) })
											: copy.lobby.switch}
								</AppText>
							) : null}
						</Pressable>
					);
				},
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	gap: { gap: spacing.xs },
	center: { alignItems: "center", gap: spacing.sm },
	centerText: { textAlign: "center" },
});

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
		team: {
			flexGrow: 1,
			flexBasis: "45%",
			minWidth: 150,
			gap: spacing.sm,
			borderRadius: radius.lg,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.surface,
			padding: spacing.md,
		},
		teamSelected: { borderWidth: 2, borderColor: colors.accent },
		teamHead: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
			gap: spacing.sm,
		},
		join: { color: colors.accent, marginTop: "auto" },
	});
