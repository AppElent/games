import {
	applyBackgammonPlan,
	BACKGAMMON_COLORS,
	type BackgammonMovePlan,
	canEndBackgammonTurn,
	shouldAutoEndTurn,
	toTurnState,
} from "@arcadeclub/core/backgammon";
import {
	DEFAULT_ONLINE_OPTIONS,
	ONLINE_OPTION_KEYS,
} from "@arcadeclub/core/backgammon-local";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import {
	BackgammonBoard,
	type BackgammonBoardOptions,
	type BackgammonOptionKey,
} from "#/components/backgammon/BackgammonBoard";
import { BackgammonStage } from "#/components/backgammon/BackgammonStage";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { GameEndScreen } from "#/components/games/GameEndScreen";
import {
	GameInfoOverlay,
	MatchOverlay,
} from "#/components/games/match/GameInfoOverlay";
import { MatchHud } from "#/components/games/match/MatchStage";
import { MatchWaitingScreen } from "#/components/games/match/MatchWaitingScreen";
import {
	SeatCard,
	SeatCards,
	SeatName,
} from "#/components/games/match/SeatCard";
import { useDuel } from "#/components/games/match/useDuel";
import { getGameRoute } from "#/lib/games/catalog";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import { BackgammonMoveLog } from "./BackgammonMoveLog";
import { colorLabel } from "./color-label";

type Bundle = NonNullable<FunctionReturnType<typeof api.backgammon.getBundle>>;

export function BackgammonMatch({
	bundle,
	shareUrl,
}: {
	bundle: Bundle;
	shareUrl: string;
}) {
	const messages = useMessages();
	const backgammon = messages.games.backgammon;
	const rollDice = useMutation(api.backgammon.rollDice);
	const applyMove = useMutation(api.backgammon.applyMove);
	const endTurn = useMutation(api.backgammon.endTurn);
	const rematch = useMutation(api.backgammon.rematch);
	const {
		participantId,
		seat,
		localColor,
		opponentJoined,
		finished,
		myTurn,
		occupant,
		isActive,
		seatAction,
		error,
		run,
	} = useDuel(bundle, BACKGAMMON_COLORS);
	const [showInfo, setShowInfo] = useState(false);
	const [options, setOptions] = useState<BackgammonBoardOptions>(
		DEFAULT_ONLINE_OPTIONS,
	);

	const white = occupant("white");
	const black = occupant("black");
	const winner = bundle.participants.find(
		(participant) => participant._id === bundle.state?.winnerParticipantId,
	);
	const turnState = bundle.state ? toTurnState(bundle.state) : null;

	function handlePlan(plan: BackgammonMovePlan) {
		if (!seat || !turnState) {
			return;
		}
		run(async () => {
			for (const step of plan.steps) {
				await applyMove({ ...seat, from: step.from, to: step.to });
			}
			const after = applyBackgammonPlan(turnState, plan);
			if (shouldAutoEndTurn(after, options.autoSwitchTurn)) {
				await endTurn(seat);
			}
		}, backgammon.waitingRoom.moveError);
	}

	function handleToggleOption(key: BackgammonOptionKey) {
		setOptions((current) => ({ ...current, [key]: !current[key] }));
	}

	const seatCards = (
		<SeatCards>
			<SeatCard
				label={backgammon.waitingRoom.seatWhite}
				active={isActive("white")}
			>
				<SeatName name={white?.displayName ?? messages.common.session.host} />
				<SeatCounts
					counts={
						bundle.state
							? fmt(backgammon.waitingRoom.seatCounts, {
									bar: bundle.state.bar.white,
									off: bundle.state.off.white,
								})
							: undefined
					}
				/>
			</SeatCard>
			<SeatCard
				label={backgammon.waitingRoom.seatBlack}
				active={isActive("black")}
				open={!black}
			>
				<SeatName name={black?.displayName ?? messages.common.match.openSeat} />
				<SeatCounts
					counts={
						bundle.state
							? fmt(backgammon.waitingRoom.seatCounts, {
									bar: bundle.state.bar.black,
									off: bundle.state.off.black,
								})
							: undefined
					}
				/>
			</SeatCard>
		</SeatCards>
	);

	if (!turnState || !opponentJoined) {
		return (
			<MatchWaitingScreen
				title={bundle.session.title}
				gameTitle={messages.catalog.backgammon.title}
				status={backgammon.waitingRoom.shareToClaimBlackSeat}
				seats={seatCards}
				error={error}
				shareUrl={shareUrl}
				participants={bundle.participants}
			/>
		);
	}

	return (
		<FullscreenGameShell
			title={bundle.session.title}
			hud={
				<MatchHud onInfo={() => setShowInfo((open) => !open)}>
					{error ? (
						<span className="max-w-[50vw] truncate rounded-xl bg-orange-950/70 px-3 py-2 text-xs text-orange-200 backdrop-blur">
							{error}
						</span>
					) : null}
				</MatchHud>
			}
		>
			<BackgammonStage
				board={
					<BackgammonBoard
						state={turnState}
						interactive={myTurn}
						canRoll={myTurn && turnState.dice.length === 0}
						canEndTurn={myTurn && canEndBackgammonTurn(turnState)}
						options={options}
						optionKeys={ONLINE_OPTION_KEYS}
						onToggleOption={handleToggleOption}
						onPlan={handlePlan}
						onRoll={seatAction(rollDice, backgammon.waitingRoom.rollError)}
						onEndTurn={seatAction(endTurn, backgammon.waitingRoom.endTurnError)}
						statusOverride={
							finished
								? fmt(backgammon.waitingRoom.finishedStatus, {
										name:
											winner?.displayName ??
											backgammon.waitingRoom.winnerFallback,
									})
								: myTurn
									? undefined
									: fmt(backgammon.waitingRoom.waitingForPlayerToPlay, {
											name:
												(bundle.state?.activeColor === "white" ? white : black)
													?.displayName ??
												colorLabel(backgammon.board, turnState.activeColor),
										})
						}
					/>
				}
			/>
			{finished && !showInfo ? (
				<MatchOverlay>
					<div className="mx-auto max-w-md">
						<GameEndScreen
							heading={fmt(backgammon.waitingRoom.winsTheMatch, {
								name:
									winner?.displayName ?? backgammon.waitingRoom.someoneFallback,
							})}
							subtitle={
								localColor
									? winner &&
										bundle.state?.winnerParticipantId === participantId
										? backgammon.waitingRoom.subtitleWon
										: backgammon.waitingRoom.subtitleLost
									: undefined
							}
							shareText={fmt(backgammon.waitingRoom.shareText, {
								name:
									winner?.displayName ??
									backgammon.waitingRoom.someoneFallbackLower,
							})}
							onRematch={seatAction(
								rematch,
								messages.common.match.rematchError,
							)}
							newGameRoute={getGameRoute("backgammon")}
						/>
					</div>
				</MatchOverlay>
			) : null}
			{showInfo ? (
				<GameInfoOverlay
					status={
						finished
							? fmt(backgammon.waitingRoom.winsTheMatch, {
									name:
										winner?.displayName ??
										backgammon.waitingRoom.someoneFallback,
								})
							: localColor
								? fmt(backgammon.waitingRoom.youArePlaying, {
										color: colorLabel(backgammon.board, localColor),
									})
								: backgammon.waitingRoom.bothSeatsClaimed
					}
					seats={seatCards}
					shareUrl={shareUrl}
					participants={bundle.participants}
					extra={<BackgammonMoveLog moves={bundle.moves} />}
					onClose={() => setShowInfo(false)}
				/>
			) : null}
		</FullscreenGameShell>
	);
}

/** How many of a side's checkers sit on the bar and are borne off. */
function SeatCounts({ counts }: { counts?: string }) {
	return counts ? (
		<p className="mt-2 text-xs text-slate-400">{counts}</p>
	) : null;
}
