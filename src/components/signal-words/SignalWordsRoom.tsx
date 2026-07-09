import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";
import { getUserErrorMessage } from "#/lib/games/errors";
import type { SignalCardRole, SignalTeam } from "#/lib/games/signal-words";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Participant = {
	_id: Id<"sessionParticipants">;
	displayName: string;
	role: "host" | "player" | "watcher";
	seat?: string;
	connected: boolean;
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
		phase: "lobby" | "clue" | "guess" | "finished";
		words: string[];
		revealed: boolean[];
		revealedRoles: Array<SignalCardRole | null>;
		startingTeam: SignalTeam;
		currentTeam: SignalTeam;
		clueWord?: string;
		clueCount?: number;
		guessesLeft?: number;
		winnerTeam?: SignalTeam;
		trapHitBy?: SignalTeam;
	} | null;
};

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
	const [participantId, setParticipantId] = useState<string>();
	const [error, setError] = useState("");
	const [clue, setClue] = useState("");
	const [count, setCount] = useState(2);

	useEffect(() => {
		setParticipantId(
			window.sessionStorage.getItem("arcade-club.participantId") ?? undefined,
		);
	}, []);

	const me = bundle.participants.find(
		(participant) => participant._id === participantId,
	);
	const state = bundle.state;
	const myTeam: SignalTeam | undefined =
		me?.seat === "red" || me?.seat === "red-clue"
			? "red"
			: me?.seat === "blue" || me?.seat === "blue-clue"
				? "blue"
				: undefined;
	const amClueGiver = me?.seat?.endsWith("-clue") ?? false;
	const isHost = bundle.session.hostParticipantId === participantId;

	const key = useQuery(
		api.signalWords.getKey,
		amClueGiver && participantId && state && state.phase !== "lobby"
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
				<p className="club-kicker mb-2">{signalWords.loading.kicker}</p>
				<h2 className="club-title text-2xl font-bold text-white">
					{signalWords.loading.heading}
				</h2>
			</div>
		);
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
			(participant) =>
				participant.seat === team || participant.seat === `${team}-clue`,
		);
	}

	return (
		<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
			<section className="space-y-4">
				<div className="club-panel rounded-lg p-5">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="club-kicker mb-2">
								{messages.catalog["signal-words"].title}
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
							tone={finished ? "success" : inLobby ? "warning" : "success"}
							label={statusLabel}
						/>
					</div>
					{error ? (
						<p className="mt-3 text-sm text-orange-200">{error}</p>
					) : null}

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
											{participant.seat?.endsWith("-clue") ? (
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
								{inLobby && me ? (
									<div className="mt-3 flex gap-2">
										<button
											type="button"
											className="min-h-11 flex-1 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-bold text-white"
											onClick={() =>
												run(
													() =>
														joinTeam({
															sessionId: bundle.session._id,
															participantId:
																participantId as Id<"sessionParticipants">,
															team,
															clueGiver: false,
														}),
													signalWords.teams.joinError,
												)
											}
										>
											{signalWords.teams.joinAsGuesser}
										</button>
										<button
											type="button"
											className="min-h-11 flex-1 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-xs font-bold text-white"
											onClick={() =>
												run(
													() =>
														joinTeam({
															sessionId: bundle.session._id,
															participantId:
																participantId as Id<"sessionParticipants">,
															team,
															clueGiver: true,
														}),
													signalWords.teams.joinError,
												)
											}
										>
											{signalWords.teams.joinAsClueGiver}
										</button>
									</div>
								) : null}
							</div>
						))}
					</div>

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
									signalWords.actions.startGameError,
								)
							}
						>
							{signalWords.actions.startGame}
						</button>
					) : null}
				</div>

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
									onClick={() =>
										run(
											() =>
												submitGuess({
													sessionId: bundle.session._id,
													participantId:
														participantId as Id<"sessionParticipants">,
													cardIndex: index,
												}),
											signalWords.actions.guessError,
										)
									}
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

				{myClueTurn ? (
					<form
						className="club-panel flex flex-wrap items-end gap-3 rounded-lg p-4"
						onSubmit={(event) => {
							event.preventDefault();
							run(
								() =>
									submitClue({
										sessionId: bundle.session._id,
										participantId: participantId as Id<"sessionParticipants">,
										clue,
										count,
									}),
								signalWords.clueForm.error,
							).then(() => setClue(""));
						}}
					>
						<label className="flex-1">
							<span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
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
							<span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
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
						<button
							type="submit"
							className="min-h-11 rounded-md bg-white px-5 py-2 font-bold text-slate-950"
						>
							{signalWords.clueForm.submit}
						</button>
					</form>
				) : null}

				{myGuessTurn ? (
					<div className="flex justify-center">
						<button
							type="button"
							className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white"
							onClick={() =>
								run(
									() =>
										pass({
											sessionId: bundle.session._id,
											participantId: participantId as Id<"sessionParticipants">,
										}),
									signalWords.actions.passError,
								)
							}
						>
							{signalWords.actions.passTurn}
						</button>
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
									signalWords.actions.rematchError,
								)
							}
						>
							{signalWords.actions.playAgain}
						</button>
					</div>
				) : null}
			</section>
			<aside className="space-y-4">
				<QrSharePanel label={signalWords.share.invitePlayers} url={joinUrl} />
				<div className="club-panel rounded-lg p-4">
					<p className="club-kicker mb-2">{signalWords.howToPlay.heading}</p>
					<ul className="space-y-1.5 text-sm text-slate-300">
						<li>{signalWords.howToPlay.step1}</li>
						<li>{signalWords.howToPlay.step2}</li>
						<li>{signalWords.howToPlay.step3}</li>
						<li>{signalWords.howToPlay.step4}</li>
					</ul>
				</div>
			</aside>
		</div>
	);
}
