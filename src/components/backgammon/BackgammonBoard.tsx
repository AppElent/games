import type {
	BackgammonColor,
	BackgammonMoveDestination,
	BackgammonMoveSource,
	BackgammonPoint,
} from "#/lib/games/backgammon";

type BackgammonBoardProps = {
	points: BackgammonPoint[];
	selectedSource?: BackgammonMoveSource;
	activeColor: BackgammonColor;
	canMove: boolean;
	onSelectSource: (source: BackgammonMoveSource) => void;
	onSelectDestination: (destination: BackgammonMoveDestination) => void;
};

const CHECKER_SLOTS = ["one", "two", "three", "four", "five"];

export function BackgammonBoard({
	points,
	selectedSource,
	activeColor,
	canMove,
	onSelectSource,
	onSelectDestination,
}: BackgammonBoardProps) {
	const topPoints = points.slice(12, 24).reverse();
	const bottomPoints = points.slice(0, 12);

	return (
		<div className="rounded-lg border border-white/10 bg-slate-950/70 p-3 shadow-2xl shadow-black/30">
			<div className="grid min-h-[440px] grid-cols-[1fr_72px_1fr] gap-3">
				<PointRow
					points={topPoints.slice(0, 6)}
					selectedSource={selectedSource}
					activeColor={activeColor}
					canMove={canMove}
					orientation="down"
					onSelectSource={onSelectSource}
					onSelectDestination={onSelectDestination}
				/>
				<div className="row-span-2 flex flex-col gap-3">
					<button
						type="button"
						disabled={!canMove}
						onClick={() => onSelectSource("bar")}
						className={`flex h-full min-h-32 flex-col items-center justify-center rounded-md border px-2 text-xs font-bold uppercase tracking-wide transition ${
							selectedSource === "bar"
								? "border-cyan-300 bg-cyan-300/20 text-cyan-50"
								: "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10"
						} disabled:cursor-not-allowed disabled:opacity-45`}
					>
						<span>Bar</span>
					</button>
					<button
						type="button"
						disabled={!canMove || selectedSource === undefined}
						onClick={() => onSelectDestination("off")}
						className="flex h-full min-h-32 flex-col items-center justify-center rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 text-xs font-bold uppercase tracking-wide text-emerald-50 transition hover:border-emerald-200/60 hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-45"
					>
						<span>Off</span>
					</button>
				</div>
				<PointRow
					points={topPoints.slice(6, 12)}
					selectedSource={selectedSource}
					activeColor={activeColor}
					canMove={canMove}
					orientation="down"
					onSelectSource={onSelectSource}
					onSelectDestination={onSelectDestination}
				/>
				<PointRow
					points={bottomPoints.slice(0, 6)}
					selectedSource={selectedSource}
					activeColor={activeColor}
					canMove={canMove}
					orientation="up"
					onSelectSource={onSelectSource}
					onSelectDestination={onSelectDestination}
				/>
				<PointRow
					points={bottomPoints.slice(6, 12)}
					selectedSource={selectedSource}
					activeColor={activeColor}
					canMove={canMove}
					orientation="up"
					onSelectSource={onSelectSource}
					onSelectDestination={onSelectDestination}
				/>
			</div>
		</div>
	);
}

function PointRow({
	points,
	selectedSource,
	activeColor,
	canMove,
	orientation,
	onSelectSource,
	onSelectDestination,
}: {
	points: BackgammonPoint[];
	selectedSource?: BackgammonMoveSource;
	activeColor: BackgammonColor;
	canMove: boolean;
	orientation: "up" | "down";
	onSelectSource: (source: BackgammonMoveSource) => void;
	onSelectDestination: (destination: BackgammonMoveDestination) => void;
}) {
	return (
		<div className="grid grid-cols-6 gap-1.5">
			{points.map((point) => {
				const selected = selectedSource === point.point;
				const selectable =
					canMove &&
					selectedSource === undefined &&
					point.color === activeColor &&
					point.count > 0;
				const canChooseDestination = canMove && selectedSource !== undefined;
				return (
					<button
						key={point.point}
						type="button"
						disabled={!selectable && !canChooseDestination}
						onClick={() => {
							if (selectedSource === undefined) {
								if (selectable) {
									onSelectSource(point.point);
								}
								return;
							}
							onSelectDestination(point.point);
						}}
						className={`relative flex h-52 min-w-0 flex-col items-center overflow-hidden rounded-md border px-1.5 py-2 transition ${
							selected
								? "border-cyan-300 bg-cyan-300/20"
								: "border-white/10 bg-white/[0.06] hover:border-white/25 hover:bg-white/10"
						} ${
							orientation === "up" ? "justify-end" : "justify-start"
						} disabled:cursor-not-allowed disabled:opacity-70`}
					>
						<span className="absolute left-1 top-1 text-[10px] font-bold text-slate-500">
							{point.point}
						</span>
						<div
							className={`flex flex-col items-center gap-1 ${
								orientation === "up" ? "flex-col-reverse" : ""
							}`}
						>
							{CHECKER_SLOTS.slice(0, Math.min(point.count, 5)).map((slot) => (
								<span
									key={`${point.point}-${slot}`}
									className={`h-8 w-8 rounded-full border shadow-sm ${
										point.color === "white"
											? "border-white bg-slate-100"
											: point.color === "black"
												? "border-slate-500 bg-slate-900"
												: "border-transparent bg-transparent"
									}`}
								/>
							))}
						</div>
						{point.count > 5 ? (
							<span className="mt-1 rounded-full bg-black/45 px-2 py-0.5 text-xs font-bold text-white">
								{point.count}
							</span>
						) : null}
					</button>
				);
			})}
		</div>
	);
}
