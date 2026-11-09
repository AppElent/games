import { createFileRoute } from "@tanstack/react-router";
import { SquadSurgePlay } from "#/components/squad-surge/SquadSurgePlay";

export const Route = createFileRoute("/squad-surge/play")({
	component: SquadSurgePlayPage,
	staticData: { fullscreen: true },
	ssr: false,
	validateSearch: (s) => ({
		d: Number(s.d ?? 1),
		seed: Number(s.seed ?? Date.now()),
	}),
});

function SquadSurgePlayPage() {
	const { d, seed } = Route.useSearch();
	return <SquadSurgePlay d={d} seed={seed} />;
}
