import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { SquadSurgeCanvas } from "#/components/squad-surge/SquadSurgeCanvas";
import { getUserErrorMessage } from "#/lib/games/errors";
import {
	generateLevel,
	type Level,
	type SimStatus,
} from "#/lib/games/squad-surge";

import {
	loadSquadSurgeSettings,
	recordSquadSurgeRun,
	type SquadSurgeProgress,
	saveSquadSurgeSettings,
} from "#/lib/games/squad-surge-local";
import { fmt, useMessages } from "#/lib/i18n";

type SquadSurgeEndState = { status: SimStatus; army: number; z: number };

export const Route = createFileRoute("/squad-surge/play")({
	component: SquadSurgePlay,
	staticData: { fullscreen: true },
	ssr: false,
	validateSearch: (s) => ({
		d: Number(s.d ?? 1),
		seed: Number(s.seed ?? Date.now()),
	}),
});

function SquadSurgePlay() {
	const messages = useMessages();
	const play = messages.games.squadSurge.play;
	const { d, seed } = Route.useSearch();
	const navigate = useNavigate();
	const [paused, setPaused] = useState(false);
	const [endState, setEndState] = useState<SquadSurgeEndState | null>(null);
	const [progress, setProgress] = useState<SquadSurgeProgress | null>(null);
	const [soundOn, setSoundOn] = useState(
		() => loadSquadSurgeSettings().soundOn,
	);

	const toggleSound = useCallback(() => {
		setSoundOn((prev) => {
			saveSquadSurgeSettings({ soundOn: !prev });
			return !prev;
		});
	}, []);

	const { level, error } = useMemo<{ level?: Level; error?: string }>(() => {
		try {
			return { level: generateLevel(seed, d) };
		} catch (caught) {
			return { error: getUserErrorMessage(caught, play.hitASnag) };
		}
	}, [seed, d, play.hitASnag]);

	// Restart navigates to a new seed; clear the end overlay for the new run.
	// biome-ignore lint/correctness/useExhaustiveDependencies: seed/d changing IS the trigger — a new run starts
	useEffect(() => {
		setEndState(null);
		setProgress(null);
	}, [seed, d]);

	const handleEnd = useCallback(
		(state: SquadSurgeEndState) => {
			setEndState(state);
			setProgress(
				recordSquadSurgeRun({
					distance: state.z,
					difficulty: d,
					won: state.status === "won",
				}),
			);
		},
		[d],
	);

	const restart = useCallback(() => {
		navigate({
			to: "/squad-surge/play",
			search: { d, seed: Date.now() },
			replace: true,
		});
	}, [navigate, d]);

	return (
		<FullscreenGameShell
			title="Squad Surge"
			onRestart={restart}
			onPauseChange={setPaused}
		>
			{level ? (
				<>
					<SquadSurgeCanvas
						key={`${seed}-${d}`}
						level={level}
						paused={paused || endState !== null}
						soundOn={soundOn}
						onEnd={handleEnd}
					/>
					<button
						type="button"
						onClick={toggleSound}
						aria-label={soundOn ? play.muteSound : play.unmuteSound}
						className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-xl border border-white/20 bg-slate-950/60 text-lg backdrop-blur-sm"
					>
						{soundOn ? "🔊" : "🔇"}
					</button>
				</>
			) : (
				<div className="flex h-full items-center justify-center p-4">
					<p className="text-orange-200">{error ?? play.hitASnag}</p>
				</div>
			)}
			{endState && level ? (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
					<div className="club-panel w-full max-w-xs rounded-2xl p-6 text-center">
						<p className="club-kicker mb-1">
							{endState.status === "won"
								? play.victoryKicker
								: play.defeatKicker}
						</p>
						<h2 className="club-title mb-3 text-3xl font-bold text-white">
							{endState.status === "won" ? play.wonHeading : play.lostHeading}
						</h2>
						<p className="mb-1 text-sm text-slate-300">
							{endState.status === "won"
								? fmt(play.wonBody, { army: endState.army })
								: endState.army > 0
									? play.bossReachedBody
									: play.hordeWipedBody}
						</p>
						<p className="mb-5 text-sm text-slate-300">
							{fmt(play.distanceLabel, { distance: Math.floor(endState.z) })}
							{progress
								? fmt(play.bestSuffix, { best: progress.bestDistance })
								: ""}
						</p>
						<div className="flex flex-col gap-3">
							<button
								type="button"
								onClick={restart}
								className="min-h-11 rounded-xl bg-emerald-400 px-4 py-2 font-bold text-slate-950"
							>
								{messages.common.actions.playAgain}
							</button>
							<Link
								to="/squad-surge"
								className="min-h-11 rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-bold text-white"
							>
								{play.changeDifficultyButton}
							</Link>
							<Link
								to="/"
								className="min-h-11 rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-bold text-white"
							>
								{messages.common.gameShell.returnToGames}
							</Link>
						</div>
					</div>
				</div>
			) : null}
		</FullscreenGameShell>
	);
}
