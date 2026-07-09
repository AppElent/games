import { createFileRoute } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HitsterSetupForm } from "#/components/hitster/HitsterSetupForm";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/hitster/new")({
	component: HitsterNewPage,
	staticData: { fullscreen: true },
});

function HitsterNewPage() {
	const messages = useMessages();
	const hitster = messages.games.hitster;
	return (
		<FullscreenGamePage title="Hitster">
			<p className="club-kicker mb-2">{hitster.musicTimelineKicker}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-[var(--club-text)]">
				{hitster.newGame.heading}
			</h1>
			<p className="mb-6 max-w-2xl text-[var(--club-muted)]">
				{hitster.newGame.intro}
			</p>
			<HitsterSetupForm />
		</FullscreenGamePage>
	);
}
