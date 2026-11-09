import { CHESS_TIME_CONTROLS } from "@arcadeclub/chess/chess";
import type { ChessTimeControl } from "@arcadeclub/chess/enums";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate } from "#/components/games/HostGate";
import { useHostSession } from "#/lib/games/use-host-session";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/chess/new")({
	component: ChessNewPage,
	staticData: { fullscreen: true },
});

type HostColor = "white" | "black" | "random";

function ChessNewPage() {
	const messages = useMessages();
	const chess = messages.games.chess;
	const create = useMutation(api.chess.create);
	const { busy, error, host } = useHostSession("chess");
	const [timeControl, setTimeControl] = useState<ChessTimeControl>("untimed");
	const [hostColor, setHostColor] = useState<HostColor>("random");

	function handleCreate() {
		return host(
			({ hostName, guestId }) =>
				create({
					title: chess.newGame.defaultTitle,
					displayName: hostName,
					guestId,
					timeControl,
					hostColor,
				}),
			chess.newGame.createChallengeError,
		);
	}

	return (
		<FullscreenGamePage title={messages.catalog.chess.title}>
			<p className="club-kicker mb-2">{messages.catalog.chess.title}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				{chess.newGame.heading}
			</h1>
			{error ? <p className="mb-4 club-error">{error}</p> : null}
			<HostGate>
				<div className="club-panel max-w-xl rounded-lg p-6">
					<fieldset className="mb-5">
						<legend className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
							{chess.newGame.timeControlLegend}
						</legend>
						<div className="flex flex-wrap gap-2">
							{(Object.keys(CHESS_TIME_CONTROLS) as ChessTimeControl[]).map(
								(control) => (
									<button
										key={control}
										type="button"
										aria-pressed={timeControl === control}
										onClick={() => setTimeControl(control)}
										className={`min-h-11 rounded-md px-4 py-2 font-bold ${
											timeControl === control
												? "bg-white text-slate-950"
												: "border border-white/20 bg-white/10 text-white"
										}`}
									>
										{CHESS_TIME_CONTROLS[control].label}
									</button>
								),
							)}
						</div>
					</fieldset>
					<fieldset className="mb-6">
						<legend className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-400">
							{chess.newGame.colorLegend}
						</legend>
						<div className="flex flex-wrap gap-2">
							{(["random", "white", "black"] as const).map((color) => (
								<button
									key={color}
									type="button"
									aria-pressed={hostColor === color}
									onClick={() => setHostColor(color)}
									className={`min-h-11 rounded-md px-4 py-2 font-bold capitalize ${
										hostColor === color
											? "bg-white text-slate-950"
											: "border border-white/20 bg-white/10 text-white"
									}`}
								>
									{chess.newGame.colorOptions[color]}
								</button>
							))}
						</div>
					</fieldset>
					<button
						type="button"
						disabled={busy}
						onClick={handleCreate}
						className="min-h-11 w-full rounded-md bg-white px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{busy
							? chess.newGame.creatingChallenge
							: chess.newGame.createChallengeLink}
					</button>
					<p className="mt-3 text-sm text-slate-400">
						{chess.newGame.shareInstructions}
					</p>
				</div>
			</HostGate>
		</FullscreenGamePage>
	);
}
