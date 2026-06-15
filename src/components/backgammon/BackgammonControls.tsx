import { Dices } from "lucide-react";
import type { BackgammonColor } from "#/lib/games/backgammon";

type BackgammonControlsProps = {
	activeColor: BackgammonColor;
	dice: number[];
	usedDice: number[];
	canAct: boolean;
	error?: string;
	onRoll: () => void;
	onEndTurn: () => void;
};

const DICE_SLOTS = ["first", "second", "third", "fourth"];

export function BackgammonControls({
	activeColor,
	dice,
	usedDice,
	canAct,
	error,
	onRoll,
	onEndTurn,
}: BackgammonControlsProps) {
	return (
		<div className="club-panel rounded-lg p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="club-kicker mb-1">Turn</p>
					<p className="text-xl font-bold capitalize text-white">
						{activeColor}
					</p>
				</div>
				<div className="flex items-center gap-2">
					{dice.length > 0 ? (
						dice.map((die, index) => {
							const slot = DICE_SLOTS[index] ?? `slot-${die}`;
							return (
								<span
									key={slot}
									className={`grid h-11 w-11 place-items-center rounded-md border text-lg font-black ${
										index < usedDice.length
											? "border-white/10 bg-white/5 text-slate-500"
											: "border-cyan-300/50 bg-cyan-300/15 text-cyan-50"
									}`}
								>
									{die}
								</span>
							);
						})
					) : (
						<span className="grid h-11 min-w-24 place-items-center rounded-md border border-white/10 bg-white/5 px-3 text-sm font-bold text-slate-400">
							No roll
						</span>
					)}
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						disabled={!canAct || dice.length > 0}
						onClick={onRoll}
						className="inline-flex h-11 items-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
					>
						<Dices className="h-4 w-4" />
						Roll
					</button>
					<button
						type="button"
						disabled={!canAct || dice.length === 0}
						onClick={onEndTurn}
						className="h-11 rounded-md border border-white/10 bg-white/10 px-4 text-sm font-bold text-white transition hover:border-white/25 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
					>
						End turn
					</button>
				</div>
			</div>
			{error ? <p className="mt-3 text-sm text-orange-200">{error}</p> : null}
		</div>
	);
}
