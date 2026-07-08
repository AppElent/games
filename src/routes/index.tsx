import { createFileRoute } from "@tanstack/react-router";
import { GameCatalog } from "#/components/games/GameCatalog";
import { JoinGamePanel } from "#/components/games/JoinGamePanel";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
	const messages = useMessages();

	return (
		<main className="club-wrap pb-12 pt-10">
			<section className="grid gap-6 pb-8 lg:grid-cols-[1fr_360px] lg:items-end">
				<div>
					<p className="club-kicker mb-3">{messages.common.home.kicker}</p>
					<h1 className="club-title max-w-4xl text-5xl font-bold leading-none text-[var(--club-text)] sm:text-7xl">
						{messages.common.home.title}
					</h1>
					<p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--club-muted)]">
						{messages.common.home.intro}
					</p>
				</div>
				<JoinGamePanel />
			</section>
			<GameCatalog />
		</main>
	);
}
