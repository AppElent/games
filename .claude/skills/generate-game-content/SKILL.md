---
name: generate-game-content
description: Use when drafting puzzle/prompt/word-pack content for Arcade Club games (Word Links puzzles, Signal Words word packs, quiz sets, prompts) — enforces the validation-before-publication workflow and content quality rules.
---

# Generate Game Content

Content is data, not code. Generation and publication are separate steps: drafted content must pass the game's validator before it reaches players, and nothing is generated at runtime without validation. Content reaches players by one of two paths: a seed file shipped with the code, or a Workbench draft (below).

## Rules for all generated content

- Family-friendly, international English. Avoid politics, explicit content, slurs, medical/legal claims, current tragedies, and copyrighted fictional universes or branded game content (no NYT Connections puzzles, no Codenames word lists — write original items).
- No duplicate visible terms within one puzzle/board.
- Avoid ambiguity where a term could plausibly belong to two groups — unless it is a deliberate "tricky" decoy, in which case the intended group must be clearly more specific.
- Every item carries `difficulty` and, where the schema has it, an `explanation`.
- Match the game's TypeScript type exactly; run the game's validator over the finished file.

## Where content lives

| Game | Seed file | Validator |
| --- | --- | --- |
| Word Links | `packages/core/src/word-links-puzzles.ts` | `validateWordLinkPuzzle` in `packages/core/src/word-links.ts` |
| Signal Words | `packages/core/src/signal-words-packs.ts` | "word pack" tests in `packages/core/src/__tests__/signal-words.test.ts` |
| Hitster | `packages/core/src/hitster-packs.ts` | "packs" tests in `packages/core/src/__tests__/hitster.test.ts` |
| Quiz samples | `SAMPLE_QUESTIONS` in `convex/quiz.ts` | `quizQuestionValidator` |

## Workflow

1. Draft items as TypeScript data in the seed file.
2. Add/extend a test in `packages/core/src/__tests__/` that runs the validator over **every** seed item, so bad content fails CI.
3. `pnpm exec vitest run packages/core/src/__tests__/<game>.test.ts`.
4. Self-review for the quality rules above before committing.

## Workbench drafts

A signed-in user can draft content at `/workbench` without a code change. The draft is stored in the `contentDrafts` table as a JSON payload of one kind from `CONTENT_DRAFT_KINDS` (`word-links-puzzle`, `signal-words-pack`, `quiz-set`).

- `validateContentDraft(kind, payload)` in `packages/core/src/content-drafts.ts` checks every draft. `createDraft` and `updateDraft` in `convex/workbench.ts` store the field errors with the draft.
- `approveDraft` validates again and refuses with `draftInvalid` while any error remains. An approved `quiz-set` draft is inserted into `quizSets` and is playable at once. Approved word-links and signal-words drafts are only marked approved: to reach players they still go into the seed file through the workflow above.
- A new draft kind needs an entry in `CONTENT_DRAFT_KINDS`, `getDraftGameType` and `validateContentDraft`, with tests in `packages/core/src/__tests__/`.

## Word Links specifics

- 16 unique terms, exactly 4 groups of 4, difficulties easy/medium/hard/tricky (one each).
- The tricky group should contain terms that superficially fit other groups.
- Group labels must not appear verbatim among the terms.

## Signal Words specifics

- Packs of ≥ 100 single words, common nouns preferred, no proper nouns of living people, 3–12 characters, no duplicates case-insensitively.
