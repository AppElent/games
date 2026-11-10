import { createFileRoute } from "@tanstack/react-router";
import { useMessages } from "#/lib/i18n";

/** The privacy policy; App Store Connect and the iOS app's Profile tab link here. */
export const Route = createFileRoute("/privacy")({
	component: Privacy,
});

function Privacy() {
	const copy = useMessages().privacy;

	return (
		<main className="club-wrap py-10">
			<h1 className="club-title mb-2 text-4xl font-bold text-[var(--club-text)] sm:text-5xl">
				{copy.title}
			</h1>
			<p className="mb-6 text-sm text-[var(--club-muted)]">{copy.updated}</p>
			<div className="club-panel max-w-3xl rounded-2xl p-6 sm:p-8">
				<p className="text-base leading-8 text-[var(--club-muted)]">
					{copy.intro}
				</p>
				{Object.entries(copy.sections).map(([key, section]) => (
					<section key={key} className="mt-8">
						<h2 className="mb-2 text-xl font-semibold text-[var(--club-text)]">
							{section.heading}
						</h2>
						{Object.entries(section.paragraphs).map(([id, text]) => (
							<p
								key={id}
								className="mt-3 text-base leading-8 text-[var(--club-muted)]"
							>
								{text}
							</p>
						))}
					</section>
				))}
			</div>
		</main>
	);
}
