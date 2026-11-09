import type { ReactNode } from "react";
import { QrSharePanel } from "#/components/games/QrSharePanel";
import { SeatBanner } from "#/components/games/SeatBanner";

/**
 * A room game's screen (bluff dice, signal words): the header panel with the
 * game name, session title, raw join code, status banner and error line, the
 * game's own blocks below it, and an aside with the invite QR and how to play.
 * `panel` renders inside the header panel; `children` follow it.
 */
export function RoomFrame({
	gameTitle,
	title,
	joinCode,
	status,
	error,
	panel,
	children,
	inviteLabel,
	joinUrl,
	howToPlay,
}: {
	gameTitle: string;
	title: string;
	joinCode?: string;
	status: { label: string; tone: "success" | "warning" };
	error: string;
	panel: ReactNode;
	children: ReactNode;
	inviteLabel: string;
	joinUrl: string;
	howToPlay: { heading: string; steps: string[] };
}) {
	return (
		<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
			<section className="space-y-4">
				<div className="club-panel rounded-lg p-5">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div>
							<p className="club-kicker mb-2">{gameTitle}</p>
							<h1 className="club-title text-3xl font-bold text-white">
								{title}
							</h1>
						</div>
						{joinCode ? (
							<span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-bold tracking-widest text-white">
								{joinCode}
							</span>
						) : null}
					</div>
					<div className="mt-4">
						<SeatBanner tone={status.tone} label={status.label} />
					</div>
					{error ? <p className="mt-3 club-error">{error}</p> : null}
					{panel}
				</div>
				{children}
			</section>
			<aside className="space-y-4">
				<QrSharePanel label={inviteLabel} url={joinUrl} />
				<div className="club-panel rounded-lg p-4">
					<p className="club-kicker mb-2">{howToPlay.heading}</p>
					<ul className="space-y-1.5 text-sm text-slate-300">
						{howToPlay.steps.map((step) => (
							<li key={step}>{step}</li>
						))}
					</ul>
				</div>
			</aside>
		</div>
	);
}

/** Shown while the room's game state row does not exist yet. */
export function RoomLoading({
	kicker,
	heading,
}: {
	kicker: string;
	heading: string;
}) {
	return (
		<div className="club-panel rounded-lg p-6 text-center">
			<p className="club-kicker mb-2">{kicker}</p>
			<h2 className="club-title text-2xl font-bold text-white">{heading}</h2>
		</div>
	);
}

/** The host's start button at the foot of the header panel, in the lobby. */
export function RoomStartButton({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className="mt-4 min-h-11 w-full rounded-md bg-white px-5 py-2.5 font-bold text-slate-950"
			onClick={onClick}
		>
			{label}
		</button>
	);
}

/** The host's play-again button once the game is over. */
export function RoomPlayAgain({
	label,
	onClick,
}: {
	label: string;
	onClick: () => void;
}) {
	return (
		<div className="flex justify-center">
			<button
				type="button"
				className="rounded-md bg-white px-5 py-2.5 font-bold text-slate-950"
				onClick={onClick}
			>
				{label}
			</button>
		</div>
	);
}
