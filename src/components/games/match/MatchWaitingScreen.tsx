import type { ComponentProps, ReactNode } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";

/**
 * Before the second player sits down: a scrollable share screen in place of
 * the board, with the seats, the challenge link and who is here.
 */
export function MatchWaitingScreen({
	title,
	gameTitle,
	status,
	seats,
	error,
	shareLabel,
	shareUrl,
	participants,
}: {
	/** The session's title. */
	title: string;
	/** The game's name, shown as the kicker. */
	gameTitle: string;
	status: string;
	seats: ReactNode;
	error: string;
	shareLabel: string;
	shareUrl: string;
	participants: ComponentProps<typeof ParticipantList>["participants"];
}) {
	return (
		<FullscreenGamePage title={title} maxWidthClassName="max-w-md">
			<p className="club-kicker mb-2">{gameTitle}</p>
			<h1 className="club-title mb-4 text-3xl font-bold text-white">{title}</h1>
			<div className="space-y-4">
				<SeatBanner tone="warning" label={status} />
				{seats}
				{error ? <p className="club-error">{error}</p> : null}
				<QrSharePanel label={shareLabel} url={shareUrl} />
				<ParticipantList participants={participants} />
			</div>
		</FullscreenGamePage>
	);
}
