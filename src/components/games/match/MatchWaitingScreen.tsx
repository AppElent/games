import type { ComponentProps } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { MatchDetails } from "#/components/games/match/MatchDetails";

/**
 * Before the second player sits down: a scrollable share screen in place of
 * the board, with the seats, the challenge link and who is here.
 */
export function MatchWaitingScreen({
	title,
	gameTitle,
	...details
}: {
	/** The session's title. */
	title: string;
	/** The game's name, shown as the kicker. */
	gameTitle: string;
} & Omit<ComponentProps<typeof MatchDetails>, "className" | "tone">) {
	return (
		<FullscreenGamePage
			title={title}
			kicker={gameTitle}
			maxWidthClassName="max-w-md"
		>
			<h1 className="club-title mb-4 text-3xl font-bold text-white">{title}</h1>
			<MatchDetails className="space-y-4" tone="warning" {...details} />
		</FullscreenGamePage>
	);
}
