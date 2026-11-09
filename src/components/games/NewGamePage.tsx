import type { GameType } from "@arcadeclub/core/games";
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

/** The host page of a game with no options: one button that opens a session. */
export function NewGamePage({
	gameType,
	create,
	heading,
	description,
	createLabel,
	creatingLabel,
	errorFallback,
}: {
	gameType: GameType;
	create: Create;
	heading: string;
	description: string;
	createLabel: string;
	creatingLabel: string;
	errorFallback: string;
}) {
	const messages = useMessages();
	const title = messages.catalog[gameType].title;
	const { busy, error, host } = useHostSession(gameType);

	return (
		<FullscreenGamePage title={title}>
			<p className="club-kicker mb-2">{title}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				{heading}
			</h1>
			{error ? <p className="mb-4 club-error">{error}</p> : null}
			<HostGate>
				<div className="club-panel max-w-xl rounded-lg p-6">
					<p className="mb-5 text-sm text-slate-300">{description}</p>
					<button
						type="button"
						disabled={busy}
						onClick={() =>
							host(
								({ hostName, guestId }) =>
									create({ title, displayName: hostName, guestId }),
								errorFallback,
							)
						}
						className="min-h-11 w-full rounded-md bg-white px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{busy ? creatingLabel : createLabel}
					</button>
				</div>
			</HostGate>
		</FullscreenGamePage>
	);
}
