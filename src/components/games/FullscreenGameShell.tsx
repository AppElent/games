import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useMessages } from "#/lib/i18n";

/**
 * Top padding that clears the floating menu button below (`h-11` inside `p-3`).
 * `SHELL_INSET` sits content just under the button row; `SHELL_PAGE_INSET`
 * leaves a little air for scrolling pages and overlays. Change with the button.
 */
export const SHELL_INSET = "pt-14";
export const SHELL_PAGE_INSET = "pt-16";

type FullscreenGameShellProps = {
	title: string;
	children: ReactNode;
	/** Rendered along the top edge, inside the safe area. */
	hud?: ReactNode;
	onRestart?: () => void;
	/** Fired when the menu overlay opens/closes so the game loop can pause. */
	onPauseChange?: (paused: boolean) => void;
};

/**
 * Reusable fullscreen surface for games: fills the viewport (safe-area aware),
 * hides the Arcade chrome via the route's `staticData.fullscreen` flag, and
 * provides the floating menu with Resume / Restart / Return to Games.
 */
export function FullscreenGameShell({
	title,
	children,
	hud,
	onRestart,
	onPauseChange,
}: FullscreenGameShellProps) {
	const messages = useMessages();
	const [menuOpen, setMenuOpen] = useState(false);

	const setMenu = (open: boolean) => {
		setMenuOpen(open);
		onPauseChange?.(open);
	};

	return (
		<div className="game-fullscreen bg-slate-950 text-white">
			<div className="relative h-full w-full">
				{children}
				<div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-3">
					<button
						type="button"
						aria-label={
							menuOpen
								? messages.common.gameShell.closeMenu
								: messages.common.gameShell.openMenu
						}
						onClick={() => setMenu(!menuOpen)}
						className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 bg-slate-900/70 text-white backdrop-blur"
					>
						{menuOpen ? (
							<X className="h-5 w-5" />
						) : (
							<Menu className="h-5 w-5" />
						)}
					</button>
					{hud ? (
						<div className="pointer-events-auto min-w-0 flex-1">{hud}</div>
					) : null}
				</div>
				{menuOpen ? (
					<div className="club-overlay">
						<div className="club-panel w-full max-w-xs rounded-2xl p-6">
							<p className="club-kicker mb-1">
								{messages.common.gameShell.paused}
							</p>
							<h2 className="club-title mb-5 text-2xl font-bold text-white">
								{title}
							</h2>
							<div className="flex flex-col gap-3">
								<button
									type="button"
									onClick={() => setMenu(false)}
									className="min-h-11 rounded-xl bg-emerald-400 px-4 py-2 font-bold text-slate-950"
								>
									{messages.common.gameShell.resume}
								</button>
								{onRestart ? (
									<button
										type="button"
										onClick={() => {
											setMenu(false);
											onRestart();
										}}
										className="min-h-11 club-btn-secondary"
									>
										{messages.common.gameShell.restart}
									</button>
								) : null}
								<Link
									to="/"
									className="min-h-11 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-center font-bold text-white"
								>
									{messages.common.gameShell.returnToGames}
								</Link>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
