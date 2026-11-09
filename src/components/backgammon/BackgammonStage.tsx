import type { ReactNode } from "react";
import { BACKGAMMON_DESIGN_WIDTH } from "#/components/backgammon/BackgammonBoard";
import { RotateHint } from "#/components/games/FitScale";
import { MatchStage } from "#/components/games/match/MatchStage";

/** The backgammon board scaled to fit, clear of the menu button in landscape. */
export function BackgammonStage({
	board,
	align,
}: {
	board: ReactNode;
	align?: "center" | "top";
}) {
	return (
		<MatchStage
			designWidth={BACKGAMMON_DESIGN_WIDTH}
			align={align}
			insetClassName="landscape:pt-1 landscape:pl-14"
			board={board}
		>
			<RotateHint />
		</MatchStage>
	);
}
