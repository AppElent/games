import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { loadSquadSurgeProgress } from "#/lib/games/squad-surge-local";

export const Route = createFileRoute("/squad-surge/")({
	component: SquadSurgeStart,
	staticData: { fullscreen: true },
	ssr: false,
});

const DIFFICULTIES = [
	{ value: 1, label: "Recruit" },
	{ value: 2, label: "Regular" },
	{ value: 3, label: "Veteran" },
	{ value: 4, label: "Elite" },
	{ value: 5, label: "Legend" },
];

function SquadSurgeStart() {
	const navigate = useNavigate();
	const progress = useMemo(() => loadSquadSurgeProgress(), []);
	const [difficulty, setDifficulty] = useState(() =>
		Math.min(5, Math.max(1, progress.highestCleared + 1)),
	);

	return (
		<FullscreenGameShell title="Squad Surge">
			<div className="flex h-full items-center justify-center overflow-y-auto p-4">
				<div className="club-panel w-full max-w-sm rounded-2xl p-6 text-center">
					<p className="club-kicker mb-1">Squad Surge</p>
					<h1 className="club-title mb-2 text-3xl font-bold text-white">
						Grow your army, break the line
					</h1>
					<p className="mb-5 text-sm text-slate-300">
						Your squad fires automatically — steer through the better gate, grab
						weapon crates, mow down the horde, and gun down the boss at the end
						of the road.
					</p>
					<div className="mb-5 flex justify-center gap-4 text-sm text-slate-300">
						<span>
							Best distance:{" "}
							<strong className="text-white">{progress.bestDistance}m</strong>
						</span>
						<span>
							Cleared:{" "}
							<strong className="text-white">
								{progress.highestCleared > 0
									? `Level ${progress.highestCleared}`
									: "—"}
							</strong>
						</span>
					</div>
					<p className="club-kicker mb-2">Difficulty</p>
					<div className="mb-6 flex flex-wrap justify-center gap-2">
						{DIFFICULTIES.map((option) => (
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
						Deploy squad
					</button>
					<p className="text-xs text-slate-400">
						Drag or use ←/→ to steer. On iPhone/iPad, add this page to your Home
						Screen for true fullscreen play.
					</p>
				</div>
			</div>
		</FullscreenGameShell>
	);
}
