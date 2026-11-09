import { type CardGame, resolvedRules } from "@arcadeclub/core/cards/engine";

type Resolved = ReturnType<typeof resolvedRules>;
type RulesOf = { [R in Resolved as R["family"]]: R["rules"] };

/** The game's rules with its house options applied, or null when it plays another family. */
export function familyRules<F extends keyof RulesOf>(
	game: CardGame,
	options: readonly string[],
	family: F,
): RulesOf[F] | null {
	const resolved = resolvedRules(game, options);
	return resolved.family === family ? (resolved.rules as RulesOf[F]) : null;
}
