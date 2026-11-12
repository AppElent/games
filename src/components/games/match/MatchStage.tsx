import type { ReactNode } from "react";
import { FitScale } from "#/components/games/FitScale";
import {
	FullscreenGameShell,
	SHELL_INSET,
} from "#/components/games/FullscreenGameShell";
import { useMessages } from "#/lib/i18n";

/**
 * A board screen with no board yet: its status line centered in the shell,
 * orange once the game is gone (`notFound`).
 */
export function MatchStatus({
	title,
	text,
	notFound = false,
}: {
	title: string;
	text: string;
	notFound?: boolean;
}) {
	return (
		<FullscreenGameShell title={title}>
			<div className="flex h-full items-center justify-center">
				<p className={notFound ? "text-orange-200" : "text-slate-300"}>
					{text}
				</p>
			</div>
		</FullscreenGameShell>
	);
}

/**
 * The bar beside the menu button: the status line from `sm` up (phones show
 * it under the board), game items, then the info toggle.
 */
export function MatchHud({
	status,
	onInfo,
	children,
}: {
	status?: string;
	onInfo: () => void;
	children?: ReactNode;
}) {
	const messages = useMessages();
	return (
		<div className="flex items-center justify-end gap-2">
			{status !== undefined ? (
				<span className="hidden max-w-[40vw] truncate rounded-xl bg-slate-900/70 px-3 py-2 text-xs text-slate-200 backdrop-blur sm:inline">
					{status}
				</span>
			) : null}
			{children}
			<button
				type="button"
				onClick={onInfo}
				className="flex h-11 items-center rounded-xl border border-[var(--club-line-strong)] bg-slate-900/70 px-4 text-sm font-bold text-white backdrop-blur"
			>
				{messages.common.match.info}
			</button>
		</div>
	);
}

/**
 * The playing surface: an optional error line, the board scaled to fit below
 * the menu button, then whatever the game puts under it (`children`).
 */
export function MatchStage({
	board,
	designWidth,
	align,
	error,
	insetClassName,
	children,
}: {
	board: ReactNode;
	designWidth: number;
	align?: "center" | "top";
	/** Shown above the board, which then moves up to make room. */
	error?: string;
	/** Extra classes for the board area, such as a landscape inset. */
	insetClassName?: string;
	children?: ReactNode;
}) {
	return (
		<div className="flex h-full flex-col">
			{error ? (
				<p
					className={`px-4 ${SHELL_INSET} text-center text-xs text-orange-200`}
				>
					{error}
				</p>
			) : null}
			<div
				className={`min-h-0 flex-1 px-2 pb-1 ${error ? "pt-1" : SHELL_INSET}${
					insetClassName ? ` ${insetClassName}` : ""
				}`}
			>
				<FitScale designWidth={designWidth} align={align}>
					{board}
				</FitScale>
			</div>
			{children}
		</div>
	);
}
