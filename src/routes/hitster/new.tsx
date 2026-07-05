import { createFileRoute } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HitsterSetupForm } from "#/components/hitster/HitsterSetupForm";

export const Route = createFileRoute("/hitster/new")({
	component: HitsterNewPage,
	staticData: { fullscreen: true },
});

function HitsterNewPage() {
	return (
		<FullscreenGamePage title="Hitster">
			<p className="club-kicker mb-2">Music Timeline</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-[var(--club-text)]">
				Host a music timeline room
			</h1>
			<p className="mb-6 max-w-2xl text-[var(--club-muted)]">
				Pick a mode and a song pack, invite players with a code, and place
				mystery songs in the right spot of the timeline.
			</p>
			<HitsterSetupForm />
		</FullscreenGamePage>
	);
}
