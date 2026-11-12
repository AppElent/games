import { CHESS_TIME_CONTROLS } from "@arcadeclub/chess/chess";
import {
	CHESS_HOST_COLORS,
	type ChessHostColor,
	type ChessTimeControl,
} from "@arcadeclub/chess/enums";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { NewGamePage } from "#/components/games/NewGamePage";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/chess/new")({
	component: ChessNewPage,
	staticData: { fullscreen: true },
});

function ChessNewPage() {
	const chess = useMessages().games.chess;
	const create = useMutation(api.chess.create);
	const [timeControl, setTimeControl] = useState<ChessTimeControl>("untimed");
	const [hostColor, setHostColor] = useState<ChessHostColor>("random");

	function timeControlLabel(control: ChessTimeControl) {
		const { initialSeconds } = CHESS_TIME_CONTROLS[control];
		const options = chess.newGame.timeControlOptions;
		return initialSeconds === undefined
			? options.untimed
			: fmt(options.minutes, { minutes: initialSeconds / 60 });
	}

	return (
		<NewGamePage
			gameType="chess"
			create={(args) => create({ ...args, timeControl, hostColor })}
			sessionTitle={chess.newGame.defaultTitle}
			heading={chess.newGame.heading}
			createLabel={chess.newGame.createChallengeLink}
			creatingLabel={chess.newGame.creatingChallenge}
			errorFallback={chess.newGame.createChallengeError}
			footnote={chess.newGame.shareInstructions}
		>
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
										: "border border-[var(--club-line-strong)] bg-white/10 text-white"
								}`}
							>
								{timeControlLabel(control)}
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
					{CHESS_HOST_COLORS.map((color) => (
						<button
							key={color}
							type="button"
							aria-pressed={hostColor === color}
							onClick={() => setHostColor(color)}
							className={`min-h-11 rounded-md px-4 py-2 font-bold capitalize ${
								hostColor === color
									? "bg-white text-slate-950"
									: "border border-[var(--club-line-strong)] bg-white/10 text-white"
							}`}
						>
							{chess.newGame.colorOptions[color]}
						</button>
					))}
				</div>
			</fieldset>
		</NewGamePage>
	);
}
