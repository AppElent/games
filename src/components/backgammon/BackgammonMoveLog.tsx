import type {
	BackgammonColor,
	BackgammonMoveDestination,
	BackgammonMoveSource,
} from "#/lib/games/backgammon";
import type { Messages } from "#/lib/i18n";
import { fmt, useI18n } from "#/lib/i18n";

type BackgammonMove = {
	_id: string;
	moveType: "roll" | "move" | "endTurn";
	color: BackgammonColor;
	from?: BackgammonMoveSource;
	to?: BackgammonMoveDestination;
	dice: number[];
	createdAt: number;
};

export function BackgammonMoveLog({ moves }: { moves: BackgammonMove[] }) {
	const { locale, messages } = useI18n();
	const backgammon = messages.games.backgammon;
	const newestMoves = [...moves].sort(
		(left, right) => right.createdAt - left.createdAt,
	);
	const colorLabel = (color: BackgammonColor) =>
		color === "white"
			? backgammon.board.colorWhite
			: backgammon.board.colorBlack;

	return (
		<div className="club-panel rounded-lg p-4">
			<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
				{backgammon.moveLog.heading}
			</h2>
			{newestMoves.length === 0 ? (
				<p className="rounded-md bg-white/5 px-3 py-2 text-sm text-slate-400">
					{backgammon.moveLog.empty}
				</p>
			) : (
				<ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
					{newestMoves.map((move) => (
						<li
							key={move._id}
							className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
						>
							<div className="flex items-center justify-between gap-3">
								<span className="font-bold capitalize text-white">
									{colorLabel(move.color)}
								</span>
								<span className="text-xs text-slate-500">
									{new Date(move.createdAt).toLocaleTimeString(locale, {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
							</div>
							<p className="mt-1 text-slate-300">
								{formatMove(move, backgammon.moveLog)}
							</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function formatMove(
	move: BackgammonMove,
	moveLog: Messages["games"]["backgammon"]["moveLog"],
) {
	if (move.moveType === "roll") {
		return fmt(moveLog.rolled, { dice: move.dice.join(" + ") });
	}
	if (move.moveType === "endTurn") {
		return moveLog.endedTurn;
	}
	const from = formatEndpoint(move.from, moveLog);
	const to = formatEndpoint(move.to, moveLog);
	if (move.dice.length > 0) {
		return fmt(moveLog.moveWithDice, { from, to, dice: move.dice.join(", ") });
	}
	return fmt(moveLog.move, { from, to });
}

function formatEndpoint(
	endpoint: BackgammonMoveSource | BackgammonMoveDestination | undefined,
	moveLog: Messages["games"]["backgammon"]["moveLog"],
) {
	if (endpoint === undefined) {
		return moveLog.pointFallback;
	}
	if (endpoint === "bar" || endpoint === "off") {
		return endpoint;
	}
	return fmt(moveLog.pointLabel, { number: endpoint });
}
