import type { ComponentProps, ReactNode } from "react";
import { SHELL_PAGE_INSET } from "#/components/games/FullscreenGameShell";
import { ParticipantList } from "#/components/games/ParticipantList";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";
import { useMessages } from "#/lib/i18n";

/** A dimmed, scrollable layer over the board, clear of the menu button. */
export function MatchOverlay({ children }: { children: ReactNode }) {
	return (
		<div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm">
			<div
				className={`h-full touch-pan-y overflow-y-auto overscroll-contain p-4 ${SHELL_PAGE_INSET}`}
			>
				{children}
			</div>
		</div>
	);
}

/**
 * The match's details during play: status, seats, the challenge link, who is
 * here and any game extras (such as a move list), then a close button.
 */
export function GameInfoOverlay({
	status,
	seats,
	shareLabel,
	shareUrl,
	participants,
	extra,
	onClose,
}: {
	status: string;
	seats: ReactNode;
	shareLabel: string;
	shareUrl: string;
	participants: ComponentProps<typeof ParticipantList>["participants"];
	extra?: ReactNode;
	onClose: () => void;
}) {
	const messages = useMessages();
	return (
		<MatchOverlay>
			<div className="mx-auto max-w-md space-y-4">
				<SeatBanner tone="success" label={status} />
				{seats}
				<QrSharePanel label={shareLabel} url={shareUrl} />
				<ParticipantList participants={participants} />
				{extra}
				<button
					type="button"
					onClick={onClose}
					className="w-full min-h-11 club-btn-secondary"
				>
					{messages.common.actions.close}
				</button>
			</div>
		</MatchOverlay>
	);
}
