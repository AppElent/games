import { Link } from "@tanstack/react-router";
import { Menu, Volume2, VolumeX, X } from "lucide-react";
import { type ReactNode, useState } from "react";

type FullscreenGameShellProps = {
	title: string;
	children: ReactNode;
	/** Rendered along the top edge, inside the safe area. */
	hud?: ReactNode;
	onRestart?: () => void;
	/** Fired when the menu overlay opens/closes so the game loop can pause. */
	onPauseChange?: (paused: boolean) => void;
	soundOn?: boolean;
	onSoundToggle?: () => void;
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
	soundOn,
	onSoundToggle,
}: FullscreenGameShellProps) {
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
						aria-label={menuOpen ? "Close menu" : "Open menu"}
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
					<div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
						<div className="club-panel w-full max-w-xs rounded-2xl p-6">
							<p className="club-kicker mb-1">Paused</p>
							<h2 className="club-title mb-5 text-2xl font-bold text-white">
								{title}
							</h2>
							<div className="flex flex-col gap-3">
								<button
									type="button"
									onClick={() => setMenu(false)}
									className="min-h-11 rounded-xl bg-emerald-400 px-4 py-2 font-bold text-slate-950"
								>
									Resume
								</button>
								{onRestart ? (
									<button
										type="button"
										onClick={() => {
											setMenu(false);
											onRestart();
										}}
										className="min-h-11 rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-bold text-white"
									>
										Restart
									</button>
								) : null}
								{onSoundToggle ? (
									<button
										type="button"
										onClick={onSoundToggle}
										className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-bold text-white"
									>
										{soundOn ? (
											<Volume2 className="h-4 w-4" />
										) : (
											<VolumeX className="h-4 w-4" />
										)}
										Sound {soundOn ? "on" : "off"}
									</button>
								) : null}
								<Link
									to="/"
									className="min-h-11 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-center font-bold text-white"
								>
									Return to Games
								</Link>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
