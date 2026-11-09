import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { HostGate } from "#/components/games/HostGate";
import { Workbench } from "#/components/workbench/Workbench";

export const Route = createFileRoute("/workbench/")({
	component: WorkbenchPage,
});

/**
 * AI content workbench: paste a generated draft, validate it, and approve
 * it before it becomes playable. Nothing here is public until approved.
 */
function WorkbenchPage() {
	return (
		<main className="club-wrap py-10">
			<p className="club-kicker mb-2 flex items-center gap-2">
				<FlaskConical className="h-4 w-4" />
				Content workbench
			</p>
			<h1 className="club-title mb-2 text-4xl font-bold text-[var(--club-text)]">
				Draft, validate, approve
			</h1>
			<p className="mb-8 max-w-2xl text-[var(--club-muted)]">
				Paste AI-generated or hand-written content here. It stays private until
				validation passes and you approve it — nothing goes live from a raw
				draft.
			</p>
			<HostGate>
				<Workbench />
			</HostGate>
		</main>
	);
}
