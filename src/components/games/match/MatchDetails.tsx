import type { ComponentProps, ReactNode } from "react";
import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";
import { useMessages } from "#/lib/i18n";

/**
 * A match's details: status, seats, an error line, the challenge link, who is
 * here, then whatever the screen adds (`children`).
 */
export function MatchDetails({
	className,
	tone,
	status,
	seats,
	error,
	shareUrl,
	participants,
	children,
}: {
	className: string;
	tone: "success" | "warning";
	status: string;
	seats: ReactNode;
	error?: string;
	shareUrl: string;
	participants: ComponentProps<typeof ParticipantList>["participants"];
	children?: ReactNode;
}) {
	const messages = useMessages();
	return (
		<div className={className}>
			<SeatBanner tone={tone} label={status} />
			{seats}
			{error ? <p className="club-error">{error}</p> : null}
			<QrSharePanel
				label={messages.common.match.challengeLink}
				url={shareUrl}
			/>
			<ParticipantList participants={participants} />
			{children}
		</div>
	);
}
