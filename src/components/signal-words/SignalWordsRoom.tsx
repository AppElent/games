import {
	isSignalClueGiver,
	type SignalCardRole,
	type SignalTeam,
	signalSeatTeam,
} from "@arcadeclub/core/signal-words";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import {
	RoomFrame,
	RoomLoading,
	RoomPlayAgain,
	RoomStartButton,
} from "#/components/games/RoomFrame";
import { useSeatAction } from "#/lib/games/use-seat-action";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

type Bundle = NonNullable<FunctionReturnType<typeof api.signalWords.getBundle>>;

const ROLE_STYLES: Record<SignalCardRole, string> = {
	red: "bg-rose-500/80 text-rose-50 border-rose-400/50",
	blue: "bg-sky-500/80 text-sky-50 border-sky-400/50",
	neutral: "bg-stone-400/70 text-stone-950 border-stone-300/50",
	trap: "bg-slate-950 text-orange-200 border-orange-400/60",
};

const KEY_DOT: Record<SignalCardRole, string> = {
	red: "bg-rose-400",
	blue: "bg-sky-400",
	neutral: "bg-stone-300",
	trap: "bg-orange-400",
};

export function SignalWordsRoom({
	bundle,
	joinUrl,
}: {
	bundle: Bundle;
	joinUrl: string;
}) {
	const { messages, locale } = useI18n();
	const signalWords = messages.games.signalWords;
	const joinTeam = useMutation(api.signalWords.joinTeam);
	const start = useMutation(api.signalWords.start);
	const submitClue = useMutation(api.signalWords.submitClue);
	const submitGuess = useMutation(api.signalWords.submitGuess);
	const pass = useMutation(api.signalWords.pass);
	const rematch = useMutation(api.signalWords.rematch);
	const { participantId, seat, seatAction, error } = useSeatAction(
		bundle.session._id,
	);
	const [clue, setClue] = useState("");
	const [count, setCount] = useState(2);

	const me = bundle.participants.find(
		(participant) => participant._id === participantId,
	);
	const state = bundle.state;
	const myTeam = signalSeatTeam(me?.seat);
	const amClueGiver = isSignalClueGiver(me?.seat);
	const isHost = bundle.session.hostParticipantId === participantId;

	const key = useQuery(
		api.signalWords.getKey,
		amClueGiver && seat && state && state.phase !== "lobby" ? seat : "skip",
	);

	if (!state) {
		return <RoomLoading />;
	}

	const inLobby = state.phase === "lobby";
	const finished = state.phase === "finished";
	const myClueTurn =
		state.phase === "clue" && amClueGiver && myTeam === state.currentTeam;
	const myGuessTurn =
		state.phase === "guess" && !amClueGiver && myTeam === state.currentTeam;

	const teamNameCap = (team: SignalTeam | undefined) =>
		team === "red" ? signalWords.teams.nameRed : signalWords.teams.nameBlue;
	const teamNameLower = (team: SignalTeam | undefined) =>
		team === "red"
			? signalWords.teams.nameRedLower
			: signalWords.teams.nameBlueLower;

	const statusLabel = inLobby
		? signalWords.status.pickTeams
		: finished
			? state.trapHitBy
				? fmt(signalWords.status.teamWinsByTrap, {
						team: teamNameCap(state.winnerTeam),
						trapTeam: teamNameLower(state.trapHitBy),
					})
				: fmt(signalWords.status.teamWins, {
						team: teamNameCap(state.winnerTeam),
					})
			: state.phase === "clue"
				? fmt(signalWords.status.waitingForClueGiver, {
						team: teamNameLower(state.currentTeam),
					})
				: fmt(signalWords.status.guessing, {
						team: teamNameCap(state.currentTeam),
						clue: state.clueWord ?? "",
						count: state.clueCount ?? 0,
						guessesLeft: plural(
							locale,
							state.guessesLeft ?? 0,
							signalWords.status.guessesLeftCount,
						),
					});

	function teamMembers(team: SignalTeam) {
		return bundle.participants.filter(
			(participant) => signalSeatTeam(participant.seat) === team,
		);
	}

	return (
		<RoomFrame
			gameTitle={messages.catalog["signal-words"].title}
			title={bundle.session.title}
			joinCode={bundle.session.joinCode}
			status={statusLabel}
			inLobby={inLobby}
			error={error}
			joinUrl={joinUrl}
			howToPlay={{
				heading: signalWords.howToPlay.heading,
				steps: [
					signalWords.howToPlay.step1,
					signalWords.howToPlay.step2,
					signalWords.howToPlay.step3,
					signalWords.howToPlay.step4,
				],
			}}
			panel={
				<>
					<div className="mt-4 grid gap-3 md:grid-cols-2">
						{(["red", "blue"] as const).map((team) => (
							<div
								key={team}
								className={`rounded-lg border p-4 ${
									team === "red"
										? "border-rose-400/30 bg-rose-500/10"
										: "border-sky-400/30 bg-sky-500/10"
								}`}
							>
								<p className="text-xs font-bold uppercase tracking-wide text-slate-300">
									{fmt(signalWords.teams.label, { team: teamNameLower(team) })}
								</p>
								<ul className="mt-2 space-y-1 text-sm text-white">
									{teamMembers(team).map((participant) => (
										<li key={participant._id} className="flex justify-between">
											<span className="truncate">
												{participant.displayName}
											</span>
											{isSignalClueGiver(participant.seat) ? (
												<span className="text-xs uppercase text-slate-300">
													{signalWords.teams.clueGiverTag}
												</span>
											) : null}
										</li>
									))}
									{teamMembers(team).length === 0 ? (
										<li className="text-slate-400">
											{signalWords.teams.noPlayersYet}
										</li>
									) : null}
								</ul>
								{inLobby && me && participantId ? (
									<div className="mt-3 flex gap-2">
										<button
											type="button"
											className="min-h-11 flex-1 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-bold text-white"
											onClick={seatAction(
												(seat) => joinTeam({ ...seat, team, clueGiver: false }),
												signalWords.teams.joinError,
											)}
										>
											{signalWords.teams.joinAsGuesser}
										</button>
										<button
											type="button"
											className="min-h-11 flex-1 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-bold text-white"
											onClick={seatAction(
												(seat) => joinTeam({ ...seat, team, clueGiver: true }),
												signalWords.teams.joinError,
											)}
										>
											{signalWords.teams.joinAsClueGiver}
										</button>
									</div>
								) : null}
							</div>
						))}
					</div>

					{inLobby && isHost && participantId ? (
						<RoomStartButton
							label={signalWords.actions.startGame}
							onClick={seatAction(start, signalWords.actions.startGameError)}
						/>
					) : null}
				</>
			}
		>
			{!inLobby ? (
				<div className="grid grid-cols-5 gap-1.5 sm:gap-2">
					{state.words.map((word, index) => {
						const revealedRole = state.revealedRoles[index];
						const keyRole = key?.[index];
						const clickable = myGuessTurn && !state.revealed[index];
						return (
							<button
								key={word}
								type="button"
								disabled={!clickable}
								onClick={seatAction(
									(seat) => submitGuess({ ...seat, cardIndex: index }),
									signalWords.actions.guessError,
								)}
								className={`relative flex min-h-11 items-center justify-center rounded-md border px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide sm:py-4 sm:text-xs ${
									revealedRole && state.revealed[index]
										? `${ROLE_STYLES[revealedRole]} opacity-90`
										: revealedRole
											? `${ROLE_STYLES[revealedRole]}`
											: "border-white/15 bg-white/10 text-white"
								} ${clickable ? "hover:bg-white/25" : ""}`}
							>
								{word}
								{keyRole && !state.revealed[index] && !finished ? (
									<span
										className={`absolute right-1 top-1 h-2 w-2 rounded-full ${KEY_DOT[keyRole]}`}
										title={signalWords.roles[keyRole]}
									/>
								) : null}
							</button>
						);
					})}
				</div>
			) : null}

			{myClueTurn && participantId ? (
				<form
					className="club-panel flex flex-wrap items-end gap-3 rounded-lg p-4"
					onSubmit={(event) => {
						event.preventDefault();
						seatAction(
							(seat) => submitClue({ ...seat, clue, count }),
							signalWords.clueForm.error,
						)?.().then((sent) => {
							if (sent) {
								setClue("");
							}
						});
					}}
				>
					<label className="flex-1">
						<span className="mb-1 club-field-label">
							{signalWords.clueForm.label}
						</span>
						<input
							value={clue}
							onChange={(event) => setClue(event.target.value)}
							className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white"
							placeholder={signalWords.clueForm.placeholder}
						/>
					</label>
					<label>
						<span className="mb-1 club-field-label">
							{signalWords.clueForm.countLabel}
						</span>
						<select
							value={count}
							onChange={(event) => setCount(Number(event.target.value))}
							className="rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-white"
						>
							{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
								<option key={value} value={value}>
									{value}
								</option>
							))}
						</select>
					</label>
					<button type="submit" className="min-h-11 club-btn-primary">
						{signalWords.clueForm.submit}
					</button>
				</form>
			) : null}

			{myGuessTurn && participantId ? (
				<div className="flex justify-center">
					<button
						type="button"
						className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white"
						onClick={seatAction(pass, signalWords.actions.passError)}
					>
						{signalWords.actions.passTurn}
					</button>
				</div>
			) : null}

			{finished && isHost && participantId ? (
				<RoomPlayAgain
					label={signalWords.actions.playAgain}
					onClick={seatAction(rematch, messages.common.match.rematchError)}
				/>
			) : null}
		</RoomFrame>
	);
}
