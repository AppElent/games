---
name: generate-game-content
description: Use when drafting puzzle/prompt/word-pack content for Arcade Club games (Word Links puzzles, Signal Words word packs, quiz sets, prompts) — enforces the validation-before-publication workflow and content quality rules.
---

# Generate Game Content

Content is data, not code. Generation and publication are separate steps: drafted content must pass the game's validator before it ships in a seed file, and seed files are the only way content reaches players (no runtime generation without validation).

## Rules for all generated content

- Family-friendly, international English. Avoid politics, explicit content, slurs, medical/legal claims, current tragedies, and copyrighted fictional universes or branded game content (no NYT Connections puzzles, no Codenames word lists — write original items).
- No duplicate visible terms within one puzzle/board.
- Avoid ambiguity where a term could plausibly belong to two groups — unless it is a deliberate "tricky" decoy, in which case the intended group must be clearly more specific.
- Every item carries `difficulty` and, where the schema has it, an `explanation`.
- Match the game's TypeScript type exactly; run the game's validator over the finished file.

## Where content lives

| Game | Seed file | Validator |
| --- | --- | --- |
| Word Links | `src/lib/games/word-links-puzzles.ts` | `validateWordLinkPuzzle` in `src/lib/games/word-links.ts` |
| Signal Words | `src/lib/games/signal-words-packs.ts` | word pack checks in `src/lib/games/signal-words.ts` |
| Hitster | `src/lib/games/hitsterPacks.ts` | existing pack shape |
| Quiz samples | `convex/quiz.ts` sample sets | quiz question validator |

## Workflow

1. Draft items as TypeScript data in the seed file.
2. Add/extend a test in `src/lib/games/__tests__/` that runs the validator over **every** seed item, so bad content fails CI.
3. `pnpm exec vitest run src/lib/games/__tests__/<game>.test.ts`.
4. Self-review for the quality rules above before committing.

## Word Links specifics

- 16 unique terms, exactly 4 groups of 4, difficulties easy/medium/hard/tricky (one each).
- The tricky group should contain terms that superficially fit other groups.
- Group labels must not appear verbatim among the terms.

## Signal Words specifics

- Packs of ≥ 100 single words, common nouns preferred, no proper nouns of living people, 3–12 characters, no duplicates case-insensitively.
