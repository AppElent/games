import { Link } from "@tanstack/react-router";
import { Check, Copy, Home, RotateCcw, Sparkles } from "lucide-react";
import { useMessages } from "#/lib/i18n";
import { useCopyFeedback } from "#/lib/use-copy-feedback";

/**
 * Shared end-of-game panel: result headline, rematch, next actions, and a
 * spoiler-free share button. Games render it once their state is terminal.
 */
export function GameEndScreen({
	heading,
	subtitle,
	shareText,
	onRematch,
	newGameRoute,
	newGameLabel,
}: {
	heading: string;
	subtitle?: string;
	shareText?: string;
	/** Offered by the two-seat matches, whose rematch swaps colours. */
	onRematch?: () => void;
	newGameRoute?: string;
	newGameLabel?: string;
}) {
	const messages = useMessages();
	const { copied, copy } = useCopyFeedback();
	const resolvedNewGameLabel =
		newGameLabel ?? messages.common.endScreen.newGame;

	return (
		<section className="club-panel rounded-lg p-6 text-center">
			<Sparkles className="mx-auto h-8 w-8 text-cyan-300" />
			<h2 className="club-title mt-3 text-3xl font-bold text-white">
				{heading}
			</h2>
			{subtitle ? <p className="mt-2 text-slate-300">{subtitle}</p> : null}
			<div className="mt-6 flex flex-wrap items-center justify-center gap-3">
				{onRematch ? (
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 font-bold text-slate-950 hover:bg-cyan-100"
						onClick={onRematch}
					>
						<RotateCcw className="h-4 w-4" />
						{messages.common.match.rematch}
					</button>
				) : null}
				{newGameRoute ? (
					<Link
						to={newGameRoute}
						className="inline-flex items-center gap-2 rounded-md club-btn-outline bg-white/10 px-5 py-2.5 font-bold text-white no-underline hover:bg-white/15"
					>
						{resolvedNewGameLabel}
					</Link>
				) : null}
				{shareText ? (
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-md club-btn-outline bg-white/10 px-5 py-2.5 font-bold text-white hover:bg-white/15"
						onClick={() => void copy(shareText)}
					>
						{copied ? (
							<Check className="h-4 w-4 text-emerald-300" />
						) : (
							<Copy className="h-4 w-4" />
						)}
						{copied
							? messages.common.actions.copied
							: messages.common.endScreen.shareResult}
					</button>
				) : null}
				<Link
					to="/"
					className="inline-flex items-center gap-2 rounded-md club-btn-outline px-5 py-2.5 font-bold text-slate-300 no-underline hover:bg-white/10"
				>
					<Home className="h-4 w-4" />
					{messages.common.endScreen.backToArcade}
				</Link>
			</div>
		</section>
	);
}
