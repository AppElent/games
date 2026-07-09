import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";
import { describeBluffClaim } from "#/lib/games/bluff-dice";
import { getUserErrorMessage } from "#/lib/games/errors";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Participant = {
	_id: Id<"sessionParticipants">;
	displayName: string;
	role: "host" | "player" | "watcher";
	connected: boolean;
};

type Claim = {
	quantity: number;
	face: number;
	byParticipantId: Id<"sessionParticipants">;
};

type Bundle = {
	session: {
		_id: Id<"gameSessions">;
		title: string;
		joinCode?: string;
		hostParticipantId?: Id<"sessionParticipants">;
	};
	participants: Participant[];
	state: {
		phase: "lobby" | "claim" | "finished";
		turnOrder: Id<"sessionParticipants">[];
		diceCounts: Array<{
			participantId: Id<"sessionParticipants">;
			count: number;
		}>;
		activeIndex: number;
		roundNumber: number;
		claimHistory: Claim[];
		lastReveal?: {
			claim: Claim;
			challengerParticipantId: Id<"sessionParticipants">;
			actualCount: number;
			loserParticipantId: Id<"sessionParticipants">;
			hands: Array<{
				participantId: Id<"sessionParticipants">;
				values: number[];
			}>;
		};
		winnerParticipantId?: Id<"sessionParticipants">;
	} | null;
};

const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function BluffDiceRoom({
	bundle,
	joinUrl,
}: {
	bundle: Bundle;
	joinUrl: string;
}) {
	const { messages, locale } = useI18n();
	const bluffDice = messages.games.bluffDice;
	const start = useMutation(api.bluffDice.start);
	const submitClaim = useMutation(api.bluffDice.submitClaim);
	const challenge = useMutation(api.bluffDice.challenge);
	const rematch = useMutation(api.bluffDice.rematch);
	const [participantId, setParticipantId] = useState<string>();
	const [error, setError] = useState("");
	const [quantity, setQuantity] = useState(2);
	const [face, setFace] = useState(3);

	useEffect(() => {
		setParticipantId(
			window.sessionStorage.getItem("arcade-club.participantId") ?? undefined,
		);
	}, []);

	const state = bundle.state;
	const myDice = useQuery(
		api.bluffDice.getMyDice,
		participantId && state && state.phase !== "lobby"
			? {
					sessionId: bundle.session._id,
					participantId: participantId as Id<"sessionParticipants">,
				}
			: "skip",
	);

	async function run(action: () => Promise<unknown>, fallback: string) {
		setError("");
		try {
			await action();
		} catch (caught) {
			setError(getUserErrorMessage(caught, fallback));
		}
	}

	if (!state) {
		return (
			<div className="club-panel rounded-lg p-6 text-center">
				<p className="club-kicker mb-2">{bluffDice.room.loadingKicker}</p>
				<h2 className="club-title text-2xl font-bold text-white">
					{bluffDice.room.loadingHeading}
				</h2>
			</div>
		);
	}

	const nameOf = (id: Id<"sessionParticipants">) =>
		bundle.participants.find((participant) => participant._id === id)
			?.displayName ?? bluffDice.room.playerFallback;
	const inLobby = state.phase === "lobby";
	const finished = state.phase === "finished";
	const activeId = state.turnOrder[state.activeIndex];
	const myTurn = !inLobby && !finished && activeId === participantId;
	const isHost = bundle.session.hostParticipantId === participantId;
	const lastClaim = state.claimHistory.at(-1);
	const totalDice = state.diceCounts.reduce(
		(sum, entry) => sum + entry.count,
		0,
	);

	const statusLabel = inLobby
		? bluffDice.room.waitingForPlayers
		: finished
			? fmt(bluffDice.room.winsTable, {
					name: state.winnerParticipantId
						? nameOf(state.winnerParticipantId)
						: bluffDice.room.someoneFallback,
				})
			: myTurn
				? lastClaim
					? bluffDice.room.yourTurnRaiseOrChallenge
					: bluffDice.room.yourTurnFirstClaim
				: fmt(bluffDice.room.waitingForPlayer, { name: nameOf(activeId) });

	return (
		<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
			<section className="space-y-4">
				<div className="club-panel rounded-lg p-5">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="club-kicker mb-2">
								{messages.catalog["bluff-dice"].title}
							</p>
							<h1 className="club-title text-3xl font-bold text-white">
								{bundle.session.title}
							</h1>
						</div>
						{bundle.session.joinCode ? (
							<span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-bold tracking-widest text-white">
								{bundle.session.joinCode}
							</span>
						) : null}
					</div>
					<div className="mt-4">
						<SeatBanner
							tone={inLobby ? "warning" : "success"}
							label={statusLabel}
						/>
					</div>
					{error ? (
						<p className="mt-3 text-sm text-orange-200">{error}</p>
					) : null}

					<ul className="mt-4 grid gap-2 sm:grid-cols-2">
						{(inLobby
							? bundle.participants.map((participant) => ({
									participantId: participant._id,
									count: undefined as number | undefined,
								}))
							: state.diceCounts
						).map((entry) => (
							<li
								key={entry.participantId}
								className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
									!inLobby && !finished && entry.participantId === activeId
										? "border-cyan-300/40 bg-cyan-300/10"
										: "border-white/10 bg-white/5"
								} ${entry.count === 0 ? "opacity-50" : ""}`}
							>
								<span className="truncate text-sm font-bold text-white">
									{nameOf(entry.participantId)}
								</span>
								{entry.count !== undefined ? (
									<span className="text-sm text-slate-300">
										{entry.count === 0
											? bluffDice.room.diceOut
											: plural(locale, entry.count, bluffDice.room.diceCount)}
									</span>
								) : null}
							</li>
						))}
					</ul>

					{inLobby && isHost ? (
						<button
							type="button"
							className="mt-4 min-h-11 w-full rounded-md bg-white px-5 py-2.5 font-bold text-slate-950"
							onClick={() =>
								run(
									() =>
										start({
											sessionId: bundle.session._id,
											participantId: participantId as Id<"sessionParticipants">,
										}),
									bluffDice.room.couldNotStartGame,
								)
							}
						>
							{bluffDice.room.startGameButton}
						</button>
					) : null}
				</div>

				{state.lastReveal ? (
					<div className="club-panel rounded-lg p-4">
						<p className="club-kicker mb-2">
							{bluffDice.room.lastChallengeKicker}
						</p>
						<p className="text-sm text-slate-200">
							{fmt(bluffDice.room.challengeSummary, {
								challenger: nameOf(state.lastReveal.challengerParticipantId),
								claimant: nameOf(state.lastReveal.claim.byParticipantId),
								claim: describeBluffClaim(state.lastReveal.claim),
								actual: state.lastReveal.actualCount,
							})}{" "}
							<span className="font-bold text-orange-200">
								{fmt(bluffDice.room.loserLosesDie, {
									name: nameOf(state.lastReveal.loserParticipantId),
								})}
							</span>
						</p>
						<div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-300">
							{state.lastReveal.hands.map((hand) => (
								<span key={hand.participantId}>
									{nameOf(hand.participantId)}:{" "}
									<span className="text-lg text-white">
										{hand.values.map((value) => DIE_FACES[value]).join(" ")}
									</span>
								</span>
							))}
						</div>
					</div>
				) : null}

				{!inLobby && !finished ? (
					<div className="club-panel rounded-lg p-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="club-kicker mb-1">
									{bluffDice.room.yourDiceKicker}
								</p>
								<p className="text-3xl text-white">
									{myDice
										? myDice.map((value) => DIE_FACES[value]).join(" ")
										: "—"}
								</p>
							</div>
							<div className="text-right text-sm text-slate-300">
								<p>
									{fmt(bluffDice.room.roundLabel, {
										number: state.roundNumber,
									})}
								</p>
								<p>{plural(locale, totalDice, bluffDice.room.diceOnTable)}</p>
							</div>
						</div>
						{lastClaim ? (
							<p className="mt-3 text-sm text-slate-200">
								{fmt(bluffDice.room.currentClaimBy, {
									name: nameOf(lastClaim.byParticipantId),
								})}{" "}
								<span className="font-bold text-white">
									{describeBluffClaim(lastClaim)}
								</span>
							</p>
						) : (
							<p className="mt-3 text-sm text-slate-400">
								{bluffDice.room.noClaimYet}
							</p>
						)}
						{myTurn ? (
							<div className="mt-4 flex flex-wrap items-end gap-3">
								<label>
									<span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
										{bluffDice.room.quantityLabel}
									</span>
									<select
										value={quantity}
										onChange={(event) =>
											setQuantity(Number(event.target.value))
										}
										className="rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
									>
										{Array.from({ length: totalDice }, (_, i) => i + 1).map(
											(value) => (
												<option key={value} value={value}>
													{value}
												</option>
											),
										)}
									</select>
								</label>
								<label>
									<span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
										{bluffDice.room.faceLabel}
									</span>
									<select
										value={face}
										onChange={(event) => setFace(Number(event.target.value))}
										className="rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
									>
										{[1, 2, 3, 4, 5, 6].map((value) => (
											<option key={value} value={value}>
												{value}
											</option>
										))}
									</select>
								</label>
								<button
									type="button"
									className="min-h-11 rounded-md bg-white px-5 py-2 font-bold text-slate-950"
									onClick={() =>
										run(
											() =>
												submitClaim({
													sessionId: bundle.session._id,
													participantId:
														participantId as Id<"sessionParticipants">,
													quantity,
													face,
												}),
											bluffDice.room.couldNotClaim,
										)
									}
								>
									{bluffDice.room.claimButton}
								</button>
								{lastClaim ? (
									<button
										type="button"
										className="min-h-11 rounded-md border border-orange-300/40 bg-orange-300/10 px-5 py-2 font-bold text-orange-100"
										onClick={() =>
											run(
												() =>
													challenge({
														sessionId: bundle.session._id,
														participantId:
															participantId as Id<"sessionParticipants">,
													}),
												bluffDice.room.couldNotChallenge,
											)
										}
									>
										{bluffDice.room.challengeButton}
									</button>
								) : null}
							</div>
						) : null}
					</div>
				) : null}

				{finished && isHost ? (
					<div className="flex justify-center">
						<button
							type="button"
							className="rounded-md bg-white px-5 py-2.5 font-bold text-slate-950"
							onClick={() =>
								run(
									() =>
										rematch({
											sessionId: bundle.session._id,
											participantId: participantId as Id<"sessionParticipants">,
										}),
									bluffDice.room.couldNotStartRematch,
								)
							}
						>
							{messages.common.actions.playAgain}
						</button>
					</div>
				) : null}
			</section>
			<aside className="space-y-4">
				<QrSharePanel label={bluffDice.share.invitePlayers} url={joinUrl} />
				<div className="club-panel rounded-lg p-4">
					<p className="club-kicker mb-2">{bluffDice.room.howToPlayKicker}</p>
					<ul className="space-y-1.5 text-sm text-slate-300">
						<li>{bluffDice.room.howToPlayRollDice}</li>
						<li>{bluffDice.room.howToPlayClaim}</li>
						<li>{bluffDice.room.howToPlayOutrank}</li>
						<li>{bluffDice.room.howToPlayLoseDie}</li>
					</ul>
				</div>
			</aside>
		</div>
	);
}
