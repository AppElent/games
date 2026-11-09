import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate } from "#/components/games/HostGate";
import { useHostSession } from "#/lib/games/use-host-session";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/backgammon/new")({
	component: BackgammonNewPage,
	staticData: { fullscreen: true },
});

function BackgammonNewPage() {
	const messages = useMessages();
	const backgammon = messages.games.backgammon;
	const create = useMutation(api.backgammon.create);
	const { busy, error, host } = useHostSession("backgammon");

	return (
		<FullscreenGamePage title={messages.catalog.backgammon.title}>
			<p className="club-kicker mb-2">{messages.catalog.backgammon.title}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				{backgammon.newGame.heading}
			</h1>
			{error ? <p className="mb-4 club-error">{error}</p> : null}
			<div className="grid max-w-3xl gap-4 md:grid-cols-2">
				<div className="club-panel flex flex-col rounded-lg p-6">
					<h2 className="club-title text-2xl font-bold text-white">
						{backgammon.newGame.localMatchHeading}
					</h2>
					<p className="mt-2 flex-1 text-sm text-slate-300">
						{backgammon.newGame.localMatchDescription}
					</p>
					<Link
						to="/backgammon/local"
						className="mt-5 rounded-md bg-white px-5 py-3 text-center font-bold text-slate-950"
					>
						{backgammon.newGame.playOnDevice}
					</Link>
				</div>
				<HostGate>
					<div className="club-panel flex flex-col rounded-lg p-6">
						<h2 className="club-title text-2xl font-bold text-white">
							{backgammon.newGame.onlineChallengeHeading}
						</h2>
						<p className="mt-2 flex-1 text-sm text-slate-300">
							{backgammon.newGame.onlineChallengeDescription}
						</p>
						<button
							type="button"
							disabled={busy}
							className="mt-5 rounded-md border border-white/20 bg-white/10 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() =>
								host(
									({ hostName, guestId }) =>
										create({
											title: messages.catalog.backgammon.title,
											displayName: hostName,
											guestId,
										}),
									backgammon.newGame.createChallengeError,
								)
							}
						>
							{busy
								? backgammon.newGame.creatingChallenge
								: backgammon.newGame.createChallengeLink}
						</button>
					</div>
				</HostGate>
			</div>
		</FullscreenGamePage>
	);
}
