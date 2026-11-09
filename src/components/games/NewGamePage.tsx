import type { GameType } from "@arcadeclub/core/games";
import type { ReactNode } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate } from "#/components/games/HostGate";
import { useHostSession } from "#/lib/games/use-host-session";
import { useMessages } from "#/lib/i18n";
import type { Id } from "../../../convex/_generated/dataModel";

type Create = (args: {
	title: string;
	displayName: string;
	guestId: string;
}) => Promise<{
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
}>;

/**
 * The host page of a game: its options (`children`), then one button that
 * opens a session.
 */
export function NewGamePage({
	gameType,
	create,
	sessionTitle,
	heading,
	description,
	createLabel,
	creatingLabel,
	errorFallback,
	footnote,
	children,
}: {
	gameType: GameType;
	create: Create;
	/** The new session's title; the game's name when absent. */
	sessionTitle?: string;
	heading: string;
	description?: string;
	createLabel: string;
	creatingLabel: string;
	errorFallback: string;
	/** Shown under the button. */
	footnote?: string;
	children?: ReactNode;
}) {
	const messages = useMessages();
	const title = messages.catalog[gameType].title;
	const { busy, error, host } = useHostSession(gameType);

	return (
		<FullscreenGamePage title={title} kicker={title} heading={heading}>
			{error ? <p className="mb-4 club-error">{error}</p> : null}
			<HostGate>
				<div className="club-panel max-w-xl rounded-lg p-6">
					{description ? (
						<p className="mb-5 text-sm text-slate-300">{description}</p>
					) : null}
					{children}
					<button
						type="button"
						disabled={busy}
						onClick={() =>
							host(
								({ hostName, guestId }) =>
									create({
										title: sessionTitle ?? title,
										displayName: hostName,
										guestId,
									}),
								errorFallback,
							)
						}
						className="min-h-11 w-full rounded-md bg-white px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{busy ? creatingLabel : createLabel}
					</button>
					{footnote ? (
						<p className="mt-3 text-sm text-slate-400">{footnote}</p>
					) : null}
				</div>
			</HostGate>
		</FullscreenGamePage>
	);
}
