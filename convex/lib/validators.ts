import { type VLiteral, type VUnion, v } from "convex/values";

/**
 * A `v.union` of `v.literal`s from an `as const` array, so a stored enum has
 * one source: the array beside the rules that use it.
 */
export function literals<
	const T extends readonly [string, string, ...string[]],
>(values: T) {
	const [first, second, ...rest] = values;
	return v.union(
		v.literal(first),
		v.literal(second),
		...rest.map((value) => v.literal(value)),
	) as unknown as VUnion<
		T[number],
		{ -readonly [K in keyof T]: VLiteral<T[K], "required"> },
		"required",
		never
	>;
}
