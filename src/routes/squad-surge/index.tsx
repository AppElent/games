import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { loadSquadSurgeProgress } from "#/lib/games/squad-surge-local";
import { fmt, useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/squad-surge/")({
	component: SquadSurgeStart,
	staticData: { fullscreen: true },
	ssr: false,
});

function SquadSurgeStart() {
	const messages = useMessages();
	const start = messages.games.squadSurge.start;
	const title = messages.catalog["squad-surge"].title;
	const navigate = useNavigate();
	const progress = useMemo(() => loadSquadSurgeProgress(), []);
	const [difficulty, setDifficulty] = useState(() =>
		Math.min(5, Math.max(1, progress.highestCleared + 1)),
	);
	const difficulties = [
		{ value: 1, label: start.difficulties.recruit },
		{ value: 2, label: start.difficulties.regular },
		{ value: 3, label: start.difficulties.veteran },
		{ value: 4, label: start.difficulties.elite },
		{ value: 5, label: start.difficulties.legend },
	];

	return (
		<FullscreenGameShell title={title}>
			<div className="flex h-full items-center justify-center overflow-y-auto p-4">
				<div className="club-panel w-full max-w-sm rounded-2xl p-6 text-center">
					<p className="club-kicker mb-1">{title}</p>
					<h1 className="club-title mb-2 text-3xl font-bold text-white">
						{start.heading}
					</h1>
					<p className="mb-5 text-sm text-slate-300">{start.description}</p>
					<div className="mb-5 flex justify-center gap-4 text-sm text-slate-300">
						<span>
							{start.bestDistanceLabel}{" "}
							<strong className="text-white">{progress.bestDistance}m</strong>
						</span>
						<span>
							{start.clearedLabel}{" "}
							<strong className="text-white">
								{progress.highestCleared > 0
									? fmt(start.clearedLevel, { level: progress.highestCleared })
									: "—"}
							</strong>
						</span>
					</div>
					<p className="club-kicker mb-2">{start.difficultyKicker}</p>
					<div className="mb-6 flex flex-wrap justify-center gap-2">
						{difficulties.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => setDifficulty(option.value)}
								className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-bold ${
									difficulty === option.value
										? "border-emerald-300 bg-emerald-400 text-slate-950"
										: "border-white/20 bg-white/10 text-white"
								}`}
							>
								{option.label}
							</button>
						))}
					</div>
					<button
						type="button"
						onClick={() =>
							navigate({
								to: "/squad-surge/play",
								search: { d: difficulty, seed: Date.now() },
							})
						}
						className="mb-4 w-full min-h-12 rounded-xl bg-gradient-to-r from-red-500 to-orange-400 px-4 py-3 text-lg font-bold text-white"
					>
						{start.deployButton}
					</button>
					<p className="text-xs text-slate-400">{start.controlsHint}</p>
				</div>
			</div>
		</FullscreenGameShell>
	);
}
