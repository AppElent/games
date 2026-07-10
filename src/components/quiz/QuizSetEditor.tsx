import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ClipboardPaste, Plus, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { getUserErrorMessage } from "#/lib/games/errors";
import {
	parseQuizQuestionsTsv,
	type QuizQuestionDraft,
} from "#/lib/games/quiz";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const CHOICE_IDS = ["a", "b", "c", "d"] as const;

function emptyQuestion(index: number): QuizQuestionDraft {
	return {
		id: `q${index + 1}-${Date.now().toString(36)}`,
		prompt: "",
		choices: [
			{ id: "a", label: "" },
			{ id: "b", label: "" },
		],
		correctChoiceIds: [],
		durationSeconds: 20,
		points: 1000,
	};
}

/**
 * Create/edit form for a quiz set: inline question editing plus a
 * paste-from-spreadsheet (TSV) importer.
 */
export function QuizSetEditor({
	quizSetId,
	initialTitle = "",
	initialDescription = "",
	initialQuestions,
}: {
	quizSetId?: Id<"quizSets">;
	initialTitle?: string;
	initialDescription?: string;
	initialQuestions?: QuizQuestionDraft[];
}) {
	const messages = useMessages();
	const navigate = useNavigate();
	const createSet = useMutation(api.quiz.createSet);
	const updateSet = useMutation(api.quiz.updateSet);
	const [title, setTitle] = useState(initialTitle);
	const [description, setDescription] = useState(initialDescription);
	const [questions, setQuestions] = useState<QuizQuestionDraft[]>(
		initialQuestions?.length ? initialQuestions : [emptyQuestion(0)],
	);
	const [importText, setImportText] = useState("");
	const [importErrors, setImportErrors] = useState<string[]>([]);
	const [showImport, setShowImport] = useState(false);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	function patchQuestion(index: number, patch: Partial<QuizQuestionDraft>) {
		setQuestions((current) =>
			current.map((question, questionIndex) =>
				questionIndex === index ? { ...question, ...patch } : question,
			),
		);
	}

	function validate(): string | undefined {
		if (!title.trim()) {
			return messages.games.quiz.setEditor.titleRequired;
		}
		if (questions.length === 0) {
			return messages.games.quiz.setEditor.needsQuestion;
		}
		for (const [index, question] of questions.entries()) {
			if (!question.prompt.trim()) {
				return fmt(messages.games.quiz.setEditor.questionMissingPrompt, {
					number: index + 1,
				});
			}
			const filled = question.choices.filter((choice) => choice.label.trim());
			if (filled.length < 2) {
				return fmt(messages.games.quiz.setEditor.questionNeedsChoices, {
					number: index + 1,
				});
			}
			if (question.correctChoiceIds.length === 0) {
				return fmt(messages.games.quiz.setEditor.questionNeedsCorrectAnswer, {
					number: index + 1,
				});
			}
		}
		return undefined;
	}

	async function handleSave() {
		const problem = validate();
		if (problem) {
			setError(problem);
			return;
		}
		setBusy(true);
		setError("");
		const payload = {
			title: title.trim(),
			description: description.trim() || undefined,
			questions: questions.map((question) => ({
				...question,
				prompt: question.prompt.trim(),
				choices: question.choices.filter((choice) => choice.label.trim()),
			})),
		};
		try {
			if (quizSetId) {
				await updateSet({ quizSetId, ...payload });
			} else {
				await createSet(payload);
			}
			await navigate({ to: "/quiz/sets" });
		} catch (caught) {
			setError(
				getUserErrorMessage(caught, messages.games.quiz.setEditor.saveError),
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="space-y-5">
			<div className="club-panel rounded-lg p-5">
				<label
					className="mb-2 block text-sm font-bold text-slate-200"
					htmlFor="set-title"
				>
					{messages.games.quiz.setEditor.titleLabel}
				</label>
				<input
					id="set-title"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					placeholder={messages.games.quiz.setEditor.titlePlaceholder}
					className="mb-4 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-cyan-300"
				/>
				<label
					className="mb-2 block text-sm font-bold text-slate-200"
					htmlFor="set-description"
				>
					{messages.games.quiz.setEditor.descriptionLabel}
				</label>
				<input
					id="set-description"
					value={description}
					onChange={(event) => setDescription(event.target.value)}
					placeholder={messages.games.quiz.setEditor.descriptionPlaceholder}
					className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-cyan-300"
				/>
			</div>

			<div className="club-panel rounded-lg p-5">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">
						{messages.games.quiz.setEditor.importHeading}
					</h2>
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/10"
						onClick={() => setShowImport((value) => !value)}
					>
						<ClipboardPaste className="h-4 w-4" />
						{showImport
							? messages.games.quiz.setEditor.hideImport
							: messages.games.quiz.setEditor.pasteRows}
					</button>
				</div>
				{showImport ? (
					<>
						<p className="mb-3 text-sm text-slate-400">
							{messages.games.quiz.setEditor.importInstructionsBefore}{" "}
							<code className="text-cyan-200">2</code>{" "}
							{messages.games.quiz.setEditor.importInstructionsBetween}{" "}
							<code className="text-cyan-200">1,3</code>
							{messages.games.quiz.setEditor.importInstructionsAfter}
						</p>
						<textarea
							value={importText}
							onChange={(event) => setImportText(event.target.value)}
							rows={5}
							placeholder={messages.games.quiz.setEditor.importPlaceholder}
							className="mb-3 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-300"
						/>
						{importErrors.length > 0 ? (
							<ul className="mb-3 space-y-1 text-sm text-orange-200">
								{importErrors.map((importError) => (
									<li key={importError}>{importError}</li>
								))}
							</ul>
						) : null}
						<button
							type="button"
							className="rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950"
							onClick={() => {
								const result = parseQuizQuestionsTsv(importText);
								setImportErrors(result.errors);
								if (result.questions.length > 0) {
									setQuestions((current) => {
										const kept = current.filter(
											(question) =>
												question.prompt.trim() ||
												question.choices.some((choice) => choice.label.trim()),
										);
										const offset = kept.length;
										return [
											...kept,
											...result.questions.map((question, index) => ({
												...question,
												id: `q${offset + index + 1}-${Date.now().toString(36)}`,
											})),
										];
									});
									if (result.errors.length === 0) {
										setImportText("");
										setShowImport(false);
									}
								}
							}}
						>
							{messages.games.quiz.setEditor.importButton}
						</button>
					</>
				) : null}
			</div>

			<div className="space-y-4">
				{questions.map((question, index) => (
					<div key={question.id} className="club-panel rounded-lg p-5">
						<div className="mb-3 flex items-center justify-between">
							<h3 className="text-sm font-bold uppercase tracking-wide text-slate-300">
								{fmt(messages.games.quiz.questionNumber, { number: index + 1 })}
							</h3>
							<button
								type="button"
								aria-label={fmt(
									messages.games.quiz.setEditor.deleteQuestionAriaLabel,
									{ number: index + 1 },
								)}
								className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-orange-300"
								onClick={() =>
									setQuestions((current) =>
										current.filter(
											(_, questionIndex) => questionIndex !== index,
										),
									)
								}
							>
								<Trash2 className="h-4 w-4" />
							</button>
						</div>
						<input
							value={question.prompt}
							onChange={(event) =>
								patchQuestion(index, { prompt: event.target.value })
							}
							placeholder={messages.games.quiz.setEditor.promptPlaceholder}
							className="mb-4 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-cyan-300"
						/>
						<div className="mb-4 grid gap-2 sm:grid-cols-2">
							{question.choices.map((choice, choiceIndex) => {
								const correct = question.correctChoiceIds.includes(choice.id);
								return (
									<div key={choice.id} className="flex items-center gap-2">
										<button
											type="button"
											title={
												correct
													? messages.games.quiz.setEditor.correctAnswerTitle
													: messages.games.quiz.setEditor.markAsCorrectTitle
											}
											aria-label={fmt(
												messages.games.quiz.setEditor.toggleChoiceAriaLabel,
												{ number: choiceIndex + 1 },
											)}
											aria-pressed={correct}
											className={`h-9 w-9 shrink-0 rounded-md border text-sm font-bold ${
												correct
													? "border-emerald-300 bg-emerald-300/20 text-emerald-100"
													: "border-white/10 bg-white/5 text-slate-400"
											}`}
											onClick={() =>
												patchQuestion(index, {
													correctChoiceIds: correct
														? question.correctChoiceIds.filter(
																(id) => id !== choice.id,
															)
														: [...question.correctChoiceIds, choice.id],
												})
											}
										>
											{choice.id.toUpperCase()}
										</button>
										<input
											value={choice.label}
											onChange={(event) =>
												patchQuestion(index, {
													choices: question.choices.map((other, otherIndex) =>
														otherIndex === choiceIndex
															? { ...other, label: event.target.value }
															: other,
													),
												})
											}
											placeholder={fmt(
												messages.games.quiz.setEditor.choicePlaceholder,
												{ number: choiceIndex + 1 },
											)}
											className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none focus:border-cyan-300"
										/>
									</div>
								);
							})}
						</div>
						<div className="flex flex-wrap items-center gap-4 text-sm">
							{question.choices.length < 4 ? (
								<button
									type="button"
									className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 font-bold text-white hover:bg-white/10"
									onClick={() =>
										patchQuestion(index, {
											choices: [
												...question.choices,
												{
													id: CHOICE_IDS[question.choices.length],
													label: "",
												},
											],
										})
									}
								>
									{messages.games.quiz.setEditor.addChoice}
								</button>
							) : null}
							<label className="flex items-center gap-2 text-slate-300">
								{messages.games.quiz.setEditor.secondsLabel}
								<input
									type="number"
									min={5}
									max={300}
									value={question.durationSeconds}
									onChange={(event) =>
										patchQuestion(index, {
											durationSeconds:
												Number.parseInt(event.target.value, 10) || 20,
										})
									}
									className="w-20 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-white outline-none focus:border-cyan-300"
								/>
							</label>
							<label className="flex items-center gap-2 text-slate-300">
								{messages.games.quiz.setEditor.pointsLabel}
								<input
									type="number"
									min={100}
									max={10000}
									step={100}
									value={question.points}
									onChange={(event) =>
										patchQuestion(index, {
											points: Number.parseInt(event.target.value, 10) || 1000,
										})
									}
									className="w-24 rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-white outline-none focus:border-cyan-300"
								/>
							</label>
						</div>
					</div>
				))}
			</div>

			{error ? <p className="text-sm text-orange-200">{error}</p> : null}
			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2.5 font-bold text-white hover:bg-white/10"
					onClick={() =>
						setQuestions((current) => [
							...current,
							emptyQuestion(current.length),
						])
					}
				>
					<Plus className="h-4 w-4" />
					{messages.games.quiz.setEditor.addQuestion}
				</button>
				<button
					type="button"
					disabled={busy}
					className="inline-flex items-center gap-2 rounded-md bg-cyan-300 px-5 py-2.5 font-bold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
					onClick={() => void handleSave()}
				>
					<Save className="h-4 w-4" />
					{busy
						? messages.games.quiz.setEditor.saving
						: quizSetId
							? messages.games.quiz.setEditor.saveChanges
							: messages.games.quiz.setEditor.createQuizSet}
				</button>
			</div>
		</div>
	);
}
