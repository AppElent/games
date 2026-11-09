import type { ReactNode } from "react";
import { useMessages } from "#/lib/i18n";

/** The two seats side by side on wide screens, stacked on phones. */
export function SeatCards({ children }: { children: ReactNode }) {
	return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

/**
 * One seat of a two-player match: the side's label, a turn badge while it is
 * that side's move, and whatever the game shows below (`children`). An open
 * seat is drawn dashed.
 */
export function SeatCard({
	label,
	icon,
	active = false,
	open = false,
	children,
}: {
	label: string;
	/** Drawn before the label, such as a disc colour. */
	icon?: ReactNode;
	active?: boolean;
	open?: boolean;
	children: ReactNode;
}) {
	const messages = useMessages();
	return (
		<div
			className={`rounded-lg border p-4 ${
				open
					? "border-dashed border-orange-300/40 bg-orange-300/10"
					: active
						? "border-cyan-300/40 bg-cyan-300/10"
						: "border-white/10 bg-white/5"
			}`}
		>
			<div className="flex items-center justify-between gap-3">
				<p
					className={`${icon ? "flex items-center gap-2 " : ""}text-xs font-bold uppercase tracking-wide text-slate-400`}
				>
					{icon}
					{label}
				</p>
				{active ? (
					<span className="rounded-full bg-cyan-300/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-100">
						{messages.common.match.turn}
					</span>
				) : null}
			</div>
			{children}
		</div>
	);
}

/** The seated player's name, as the first line under a seat's label. */
export function SeatName({ name }: { name: string }) {
	return <p className="mt-1 truncate text-lg font-bold text-white">{name}</p>;
}
