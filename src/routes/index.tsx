import { createFileRoute } from "@tanstack/react-router";
import { DataDeletedNotice } from "#/components/account/DataDeletedNotice";
import { GameCatalog } from "#/components/games/GameCatalog";
import { JoinGamePanel } from "#/components/games/JoinGamePanel";
import { useMessages } from "#/lib/i18n";

type HomeSearch = {
	/** Set after "Delete Arcade Club data only", to confirm it. */
	deleted?: "app";
};

export const Route = createFileRoute("/")({
	component: HomePage,
	validateSearch: (search: Record<string, unknown>): HomeSearch =>
		search.deleted === "app" ? { deleted: "app" } : {},
});

function HomePage() {
	const messages = useMessages();
	const { deleted } = Route.useSearch();

	return (
		<main className="club-wrap club-home pb-12 pt-5 lg:pt-12">
			{deleted === "app" ? <DataDeletedNotice /> : null}
			<section className="flex flex-col gap-7 pb-8 lg:grid lg:grid-cols-[1fr_400px] lg:items-end lg:gap-10 lg:pb-12">
				<div className="order-2 lg:order-none">
					<p className="club-kicker mb-3">{messages.common.home.kicker}</p>
					<h1 className="club-title max-w-4xl text-[40px] font-bold leading-none text-[var(--club-text)] sm:text-7xl">
						{messages.common.home.title}
					</h1>
					<p className="mt-3.5 max-w-2xl text-base leading-[26px] lg:text-lg lg:leading-8 text-[var(--club-muted)]">
						{messages.common.home.intro}
					</p>
				</div>
				<JoinGamePanel />
			</section>
			<GameCatalog />
		</main>
	);
}
