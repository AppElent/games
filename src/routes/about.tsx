import { createFileRoute } from "@tanstack/react-router";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/about")({
	component: About,
});

function About() {
	const messages = useMessages();

	return (
		<main className="club-wrap py-10">
			<p className="club-kicker mb-2">{messages.common.about.kicker}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-[var(--club-text)] sm:text-5xl">
				{messages.common.about.title}
			</h1>
			<div className="club-panel max-w-3xl rounded-2xl p-6 sm:p-8">
				<p className="text-base leading-8 text-[var(--club-muted)]">
					{messages.common.about.paragraph1}
				</p>
				<p className="mt-4 text-base leading-8 text-[var(--club-muted)]">
					{messages.common.about.paragraph2}
				</p>
			</div>
		</main>
	);
}
