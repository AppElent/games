import type { GameType } from "./catalog";
import { validateWordLinkPuzzle, type WordLinkPuzzle } from "./word-links";

export type ContentDraftKind =
	| "word-links-puzzle"
	| "signal-words-pack"
	| "quiz-set";

export type ContentValidationError = { path: string; message: string };

export const CONTENT_DRAFT_KINDS: readonly ContentDraftKind[] = [
	"word-links-puzzle",
	"signal-words-pack",
	"quiz-set",
];

export function getDraftGameType(kind: ContentDraftKind): GameType {
	switch (kind) {
		case "word-links-puzzle":
			return "word-links";
		case "signal-words-pack":
			return "signal-words";
		case "quiz-set":
			return "live-quiz";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateSignalWordsPack(
	payload: unknown,
): ContentValidationError[] {
	const errors: ContentValidationError[] = [];
	if (!isRecord(payload) || !Array.isArray(payload.words)) {
		return [{ path: "words", message: "Pack must be { words: string[] }" }];
	}
	const words = payload.words;
	if (words.length < 25) {
		errors.push({
			path: "words",
			message: `A pack needs at least 25 words (got ${words.length})`,
		});
	}
	const seen = new Set<string>();
	words.forEach((word, index) => {
		if (typeof word !== "string" || !word.trim()) {
			errors.push({
				path: `words[${index}]`,
				message: "Words must be non-empty strings",
			});
			return;
		}
		if (word.trim().length > 20) {
			errors.push({
				path: `words[${index}]`,
				message: `"${word}" is longer than 20 characters`,
			});
		}
		const normalized = word.trim().toLowerCase();
		if (seen.has(normalized)) {
			errors.push({
				path: `words[${index}]`,
				message: `Duplicate word "${word}"`,
			});
		}
		seen.add(normalized);
	});
	return errors;
}

export function validateQuizSetDraft(
	payload: unknown,
): ContentValidationError[] {
	const errors: ContentValidationError[] = [];
	if (!isRecord(payload)) {
		return [{ path: "", message: "Draft must be a JSON object" }];
	}
	if (typeof payload.title !== "string" || !payload.title.trim()) {
		errors.push({ path: "title", message: "Title is required" });
	}
	if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
		errors.push({
			path: "questions",
			message: "At least one question is required",
		});
		return errors;
	}
	const questionIds = new Set<string>();
	payload.questions.forEach((question, index) => {
		const path = `questions[${index}]`;
		if (!isRecord(question)) {
			errors.push({ path, message: "Question must be an object" });
			return;
		}
		if (typeof question.id !== "string" || !question.id) {
			errors.push({ path: `${path}.id`, message: "Question id is required" });
		} else if (questionIds.has(question.id)) {
			errors.push({
				path: `${path}.id`,
				message: `Duplicate question id "${question.id}"`,
			});
		} else {
			questionIds.add(question.id);
		}
		if (typeof question.prompt !== "string" || !question.prompt.trim()) {
			errors.push({ path: `${path}.prompt`, message: "Prompt is required" });
		}
		const choices = Array.isArray(question.choices) ? question.choices : [];
		if (choices.length < 2) {
			errors.push({
				path: `${path}.choices`,
				message: "At least two choices are required",
			});
		}
		const choiceIds = new Set<string>();
		choices.forEach((choice, choiceIndex) => {
			if (
				!isRecord(choice) ||
				typeof choice.id !== "string" ||
				typeof choice.label !== "string" ||
				!choice.label.trim()
			) {
				errors.push({
					path: `${path}.choices[${choiceIndex}]`,
					message: "Choice must have an id and a label",
				});
				return;
			}
			choiceIds.add(choice.id);
		});
		const correct = Array.isArray(question.correctChoiceIds)
			? question.correctChoiceIds
			: [];
		if (correct.length === 0) {
			errors.push({
				path: `${path}.correctChoiceIds`,
				message: "Mark at least one correct choice",
			});
		}
		for (const choiceId of correct) {
			if (typeof choiceId !== "string" || !choiceIds.has(choiceId)) {
				errors.push({
					path: `${path}.correctChoiceIds`,
					message: `Correct choice "${String(choiceId)}" is not a choice id`,
				});
			}
		}
		if (
			typeof question.durationSeconds !== "number" ||
			question.durationSeconds <= 0
		) {
			errors.push({
				path: `${path}.durationSeconds`,
				message: "Duration must be a positive number of seconds",
			});
		}
		if (typeof question.points !== "number" || question.points <= 0) {
			errors.push({
				path: `${path}.points`,
				message: "Points must be a positive number",
			});
		}
	});
	return errors;
}

/**
 * Validates a raw draft payload string for the given kind. Returns
 * field-level errors; an empty array means the draft is publishable.
 */
export function validateContentDraft(
	kind: ContentDraftKind,
	rawPayload: string,
): ContentValidationError[] {
	let payload: unknown;
	try {
		payload = JSON.parse(rawPayload);
	} catch {
		return [{ path: "", message: "Payload is not valid JSON" }];
	}
	switch (kind) {
		case "word-links-puzzle": {
			// Structural pre-check: validateWordLinkPuzzle assumes the shape.
			if (
				!isRecord(payload) ||
				typeof payload.id !== "string" ||
				!Array.isArray(payload.terms) ||
				!Array.isArray(payload.groups) ||
				!payload.groups.every(
					(group) => isRecord(group) && Array.isArray(group.terms),
				)
			) {
				return [
					{
						path: "",
						message:
							"Puzzle must be { id, terms: string[], groups: { label, terms, difficulty }[] }",
					},
				];
			}
			return validateWordLinkPuzzle(payload as unknown as WordLinkPuzzle);
		}
		case "signal-words-pack":
			return validateSignalWordsPack(payload);
		case "quiz-set":
			return validateQuizSetDraft(payload);
	}
}
