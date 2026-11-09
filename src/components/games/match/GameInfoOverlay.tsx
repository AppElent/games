import type { ComponentProps, ReactNode } from "react";
import { SHELL_PAGE_INSET } from "#/components/games/FullscreenGameShell";
import { MatchDetails } from "#/components/games/match/MatchDetails";
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
 * The match's details during play, with any game extras (such as a move
 * list), then a close button.
 */
export function GameInfoOverlay({
	extra,
	onClose,
	...details
}: {
	extra?: ReactNode;
	onClose: () => void;
} & Omit<
	ComponentProps<typeof MatchDetails>,
	"className" | "tone" | "error" | "children"
>) {
	const messages = useMessages();
	return (
		<MatchOverlay>
			<MatchDetails
				className="mx-auto max-w-md space-y-4"
				tone="success"
				{...details}
			>
				{extra}
				<button
					type="button"
					onClick={onClose}
					className="w-full min-h-11 club-btn-secondary"
				>
					{messages.common.actions.close}
				</button>
			</MatchDetails>
		</MatchOverlay>
	);
}
