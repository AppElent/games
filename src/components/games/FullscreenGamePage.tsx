import type { ReactNode } from "react";
import {
	FullscreenGameShell,
	SHELL_PAGE_INSET,
} from "#/components/games/FullscreenGameShell";

type FullscreenGamePageProps = {
	title: string;
	/** Small line above `heading`, usually the game's name. */
	kicker?: string;
	/** The page's h1. */
	heading?: string;
	children: ReactNode;
	/** Tailwind max-width class for the content column. */
	maxWidthClassName?: string;
	/** Extra classes for the content column. */
	className?: string;
};

/**
 * Fullscreen surface for page-style game screens (lobbies, setup forms,
 * waiting rooms). The shell disables touch gestures globally, so this wrapper
 * restores vertical touch scrolling for its content and pads past the
 * floating menu button.
 */
export function FullscreenGamePage({
	title,
	kicker,
	heading,
	children,
	maxWidthClassName = "max-w-3xl",
	className,
}: FullscreenGamePageProps) {
	return (
		<FullscreenGameShell title={title}>
			<div className="h-full touch-pan-y overflow-y-auto overscroll-contain">
				<div
					className={`mx-auto w-full px-4 ${SHELL_PAGE_INSET} pb-8 sm:px-6 ${maxWidthClassName} ${className ?? ""}`}
				>
					{kicker !== undefined ? (
						<p className="club-kicker mb-2">{kicker}</p>
					) : null}
					{heading !== undefined ? (
						<h1 className="club-title mb-4 text-4xl font-bold text-white">
							{heading}
						</h1>
					) : null}
					{children}
				</div>
			</div>
		</FullscreenGameShell>
	);
}
