import type {
	BackgammonColor,
	BackgammonMoveDestination,
	BackgammonMoveSource,
} from "#/lib/games/backgammon";

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
	const newestMoves = [...moves].sort(
		(left, right) => right.createdAt - left.createdAt,
	);

	return (
		<div className="club-panel rounded-lg p-4">
			<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
				Move log
			</h2>
			{newestMoves.length === 0 ? (
				<p className="rounded-md bg-white/5 px-3 py-2 text-sm text-slate-400">
					No moves yet
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
									{move.color}
								</span>
								<span className="text-xs text-slate-500">
									{new Date(move.createdAt).toLocaleTimeString([], {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
							</div>
							<p className="mt-1 text-slate-300">{formatMove(move)}</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

function formatMove(move: BackgammonMove) {
	if (move.moveType === "roll") {
		return `Rolled ${move.dice.join(" + ")}`;
	}
	if (move.moveType === "endTurn") {
		return "Ended turn";
	}
	return `${formatEndpoint(move.from)} to ${formatEndpoint(move.to)}${
		move.dice.length > 0 ? ` using ${move.dice.join(", ")}` : ""
	}`;
}

function formatEndpoint(
	endpoint?: BackgammonMoveSource | BackgammonMoveDestination,
) {
	if (endpoint === undefined) {
		return "point";
	}
	if (endpoint === "bar" || endpoint === "off") {
		return endpoint;
	}
	return `point ${endpoint}`;
}
