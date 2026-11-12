import {
	CONTENT_DRAFT_KINDS,
	type ContentDraftKind,
} from "@arcadeclub/core/content-drafts";
import { useMutation, useQuery } from "convex/react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useGameAction } from "#/lib/games/use-game-action";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

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
 * The signed-in author's drafts: a form for a new one, then each draft with
 * its validation result, approve, reject, delete and a payload editor.
 */
export function Workbench() {
	const { error, run: runAction } = useGameAction();
	const drafts = useQuery(api.workbench.listMine);
	const createDraft = useMutation(api.workbench.createDraft);
	const updateDraft = useMutation(api.workbench.updateDraft);
	const approveDraft = useMutation(api.workbench.approveDraft);
	const rejectDraft = useMutation(api.workbench.rejectDraft);
	const deleteDraft = useMutation(api.workbench.deleteDraft);

	const [kind, setKind] = useState<ContentDraftKind>("word-links-puzzle");
	const [title, setTitle] = useState("");
	const [payload, setPayload] = useState("");
	const [busyId, setBusyId] = useState<string>();

	async function run(id: string | undefined, action: () => Promise<unknown>) {
		setBusyId(id);
		await runAction(action, "That action failed");
		setBusyId(undefined);
	}

	return (
		<div className="space-y-6">
			<div className="club-panel rounded-lg p-5">
				<h2 className="mb-3 club-panel-heading">New draft</h2>
				<div className="mb-3 flex flex-wrap gap-2">
					{CONTENT_DRAFT_KINDS.map((option) => (
						<button
							key={option}
							type="button"
							className={`rounded-md border px-3 py-1.5 text-sm font-bold ${
								kind === option
									? "border-[var(--club-cyan)] bg-[var(--club-cyan)]/15 text-[var(--club-text)]"
									: "club-btn-outline text-[var(--club-muted)]"
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
					className="mb-3 w-full rounded-md border border-[var(--club-line-strong)] bg-[var(--club-panel-strong)] px-3 py-2 text-[var(--club-text)] placeholder:text-[var(--club-soft)] outline-none focus:border-[var(--club-cyan)]"
				/>
				<textarea
					value={payload}
					onChange={(event) => setPayload(event.target.value)}
					rows={8}
					placeholder={KIND_PLACEHOLDERS[kind]}
					className="mb-3 w-full rounded-md border border-[var(--club-line-strong)] bg-[var(--club-panel-strong)] px-3 py-2 text-[var(--club-text)] placeholder:text-[var(--club-soft)] outline-none focus:border-[var(--club-cyan)] font-mono text-xs"
				/>
				{error ? (
					<p className="mb-3 text-sm text-[var(--club-orange)]">{error}</p>
				) : null}
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
					<p className="text-sm text-[var(--club-muted)]">No drafts yet.</p>
				) : null}
				{drafts?.map((draft) => (
					<div key={draft._id} className="club-panel rounded-lg p-5">
						<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
							<div>
								<p className="font-bold text-[var(--club-text)]">
									{draft.title}
								</p>
								<p className="text-sm text-[var(--club-muted)]">
									{KIND_LABELS[draft.kind as ContentDraftKind]} —{" "}
									<span
										className={
											draft.status === "approved"
												? "text-[var(--club-green)]"
												: draft.status === "rejected"
													? "text-[var(--club-orange)]"
													: "text-[var(--club-muted)]"
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
										className="rounded-md border border-[var(--club-green)] bg-[var(--club-green)]/10 p-2 text-[var(--club-green)] hover:bg-[var(--club-green)]/20 disabled:opacity-60"
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
										className="rounded-md border border-[var(--club-orange)] bg-[var(--club-orange)]/10 p-2 text-[var(--club-orange)] hover:bg-[var(--club-orange)]/20 disabled:opacity-60"
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
									className="rounded-md club-btn-outline p-2 text-[var(--club-muted)] hover:bg-[var(--club-line)] disabled:opacity-60"
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
							<ul className="mb-2 space-y-1 text-sm text-[var(--club-orange)]">
								{draft.validationErrors.map((message) => (
									<li key={message}>{message}</li>
								))}
							</ul>
						) : (
							<p className="mb-2 text-sm text-[var(--club-green)]">
								No validation errors.
							</p>
						)}
						<details className="text-xs text-[var(--club-muted)]">
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
				className="mb-2 w-full rounded-md border border-[var(--club-line-strong)] bg-[var(--club-panel-strong)] px-3 py-2 text-[var(--club-text)] placeholder:text-[var(--club-soft)] outline-none focus:border-[var(--club-cyan)] font-mono text-xs"
			/>
			<button
				type="button"
				className="rounded-md bg-[var(--club-text)] px-3 py-1.5 text-xs font-bold text-[var(--club-bg)]"
				onClick={() => onSave(value)}
			>
				Re-validate
			</button>
		</div>
	);
}
