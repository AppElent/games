import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Check, FlaskConical, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { HostGate } from "#/components/games/HostGate";
import {
	CONTENT_DRAFT_KINDS,
	type ContentDraftKind,
} from "#/lib/games/content-drafts";
import { getUserErrorMessage } from "#/lib/games/errors";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/workbench/")({
	component: WorkbenchPage,
});

const KIND_LABELS: Record<ContentDraftKind, string> = {
	"word-links-puzzle": "Word Links puzzle",
	"signal-words-pack": "Signal Words pack",
	"quiz-set": "Quiz set",
};

const KIND_PLACEHOLDERS: Record<ContentDraftKind, string> = {
	"word-links-puzzle": `{
  "id": "puzzle-1",
  "terms": ["ALPHA", "BRAVO", ...16 total],
  "groups": [
    { "id": "g1", "label": "NATO letters", "terms": ["ALPHA","BRAVO","CHARLIE","DELTA"], "difficulty": "easy" },
    ...4 groups total
  ]
}`,
	"signal-words-pack": `{ "words": ["APPLE", "RIVER", ...at least 25 words] }`,
	"quiz-set": `{
  "title": "Team quiz",
  "questions": [
    {
      "id": "q1",
      "prompt": "Pick A",
      "choices": [{ "id": "a", "label": "A" }, { "id": "b", "label": "B" }],
      "correctChoiceIds": ["a"],
      "durationSeconds": 20,
      "points": 1000
    }
  ]
}`,
};

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

function Workbench() {
	const drafts = useQuery(api.workbench.listMine);
	const createDraft = useMutation(api.workbench.createDraft);
	const updateDraft = useMutation(api.workbench.updateDraft);
	const approveDraft = useMutation(api.workbench.approveDraft);
	const rejectDraft = useMutation(api.workbench.rejectDraft);
	const deleteDraft = useMutation(api.workbench.deleteDraft);

	const [kind, setKind] = useState<ContentDraftKind>("word-links-puzzle");
	const [title, setTitle] = useState("");
	const [payload, setPayload] = useState("");
	const [error, setError] = useState("");
	const [busyId, setBusyId] = useState<string>();

	async function run(id: string | undefined, action: () => Promise<unknown>) {
		setBusyId(id);
		setError("");
		try {
			await action();
		} catch (caught) {
			setError(getUserErrorMessage(caught, "That action failed"));
		} finally {
			setBusyId(undefined);
		}
	}

	return (
		<div className="space-y-6">
			<div className="club-panel rounded-lg p-5">
				<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
					New draft
				</h2>
				<div className="mb-3 flex flex-wrap gap-2">
					{CONTENT_DRAFT_KINDS.map((option) => (
						<button
							key={option}
							type="button"
							className={`rounded-md border px-3 py-1.5 text-sm font-bold ${
								kind === option
									? "border-cyan-300 bg-cyan-300/20 text-cyan-100"
									: "border-white/10 bg-white/5 text-slate-300"
							}`}
							onClick={() => setKind(option)}
						>
							{KIND_LABELS[option]}
						</button>
					))}
				</div>
				<input
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					placeholder="Draft title"
					className="mb-3 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-cyan-300"
				/>
				<textarea
					value={payload}
					onChange={(event) => setPayload(event.target.value)}
					rows={8}
					placeholder={KIND_PLACEHOLDERS[kind]}
					className="mb-3 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-300"
				/>
				{error ? <p className="mb-3 text-sm text-orange-200">{error}</p> : null}
				<button
					type="button"
					disabled={busyId === "new"}
					className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
					onClick={() =>
						run("new", async () => {
							await createDraft({ kind, title, payload });
							setTitle("");
							setPayload("");
						})
					}
				>
					<Plus className="h-4 w-4" />
					Add draft
				</button>
			</div>

			<div className="space-y-4">
				{drafts?.length === 0 ? (
					<p className="text-sm text-slate-400">No drafts yet.</p>
				) : null}
				{drafts?.map((draft) => (
					<div key={draft._id} className="club-panel rounded-lg p-5">
						<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
							<div>
								<p className="font-bold text-white">{draft.title}</p>
								<p className="text-sm text-slate-400">
									{KIND_LABELS[draft.kind as ContentDraftKind]} —{" "}
									<span
										className={
											draft.status === "approved"
												? "text-emerald-300"
												: draft.status === "rejected"
													? "text-orange-300"
													: "text-slate-300"
										}
									>
										{draft.status}
									</span>
								</p>
							</div>
							<div className="flex gap-2">
								{draft.status !== "approved" ? (
									<button
										type="button"
										disabled={busyId === draft._id}
										title="Approve"
										aria-label="Approve draft"
										className="rounded-md border border-emerald-300/40 bg-emerald-300/10 p-2 text-emerald-100 hover:bg-emerald-300/20 disabled:opacity-60"
										onClick={() =>
											run(draft._id, () =>
												approveDraft({
													draftId: draft._id as Id<"contentDrafts">,
												}),
											)
										}
									>
										<Check className="h-4 w-4" />
									</button>
								) : null}
								{draft.status !== "rejected" ? (
									<button
										type="button"
										disabled={busyId === draft._id}
										title="Reject"
										aria-label="Reject draft"
										className="rounded-md border border-orange-300/40 bg-orange-300/10 p-2 text-orange-100 hover:bg-orange-300/20 disabled:opacity-60"
										onClick={() =>
											run(draft._id, () =>
												rejectDraft({
													draftId: draft._id as Id<"contentDrafts">,
												}),
											)
										}
									>
										<X className="h-4 w-4" />
									</button>
								) : null}
								<button
									type="button"
									disabled={busyId === draft._id}
									title="Delete"
									aria-label="Delete draft"
									className="rounded-md border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 disabled:opacity-60"
									onClick={() =>
										run(draft._id, () =>
											deleteDraft({
												draftId: draft._id as Id<"contentDrafts">,
											}),
										)
									}
								>
									<Trash2 className="h-4 w-4" />
								</button>
							</div>
						</div>
						{draft.validationErrors.length > 0 ? (
							<ul className="mb-2 space-y-1 text-sm text-orange-200">
								{draft.validationErrors.map((message) => (
									<li key={message}>{message}</li>
								))}
							</ul>
						) : (
							<p className="mb-2 text-sm text-emerald-300">
								No validation errors.
							</p>
						)}
						<details className="text-xs text-slate-400">
							<summary className="cursor-pointer select-none">
								Edit payload
							</summary>
							<PayloadEditor
								initialPayload={draft.payload}
								onSave={(next) =>
									run(draft._id, () =>
										updateDraft({
											draftId: draft._id as Id<"contentDrafts">,
											payload: next,
										}),
									)
								}
							/>
						</details>
					</div>
				))}
			</div>
		</div>
	);
}

function PayloadEditor({
	initialPayload,
	onSave,
}: {
	initialPayload: string;
	onSave: (payload: string) => void;
}) {
	const [value, setValue] = useState(initialPayload);
	return (
		<div className="mt-2">
			<textarea
				value={value}
				onChange={(event) => setValue(event.target.value)}
				rows={8}
				className="mb-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white outline-none focus:border-cyan-300"
			/>
			<button
				type="button"
				className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-slate-950"
				onClick={() => onSave(value)}
			>
				Re-validate
			</button>
		</div>
	);
}
