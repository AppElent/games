import { describe, expect, it } from "vitest";
import { en } from "../messages/en";
import { nl } from "../messages/nl";

type Tree = { [key: string]: string | Tree };

function collectLeaves(tree: Tree, prefix: string, out: Map<string, string>) {
	for (const [key, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			out.set(path, value);
		} else {
			collectLeaves(value, path, out);
		}
	}
}

function placeholders(message: string): string[] {
	return [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("message dictionaries", () => {
	const enLeaves = new Map<string, string>();
	const nlLeaves = new Map<string, string>();
	collectLeaves(en as unknown as Tree, "", enLeaves);
	collectLeaves(nl as unknown as Tree, "", nlLeaves);

	it("have identical key sets", () => {
		expect([...nlLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
	});

	it("have no empty messages", () => {
		for (const [path, value] of [...enLeaves, ...nlLeaves]) {
			expect(value.trim(), path).not.toBe("");
		}
	});

	it("use the same placeholders per message", () => {
		for (const [path, enValue] of enLeaves) {
			const nlValue = nlLeaves.get(path);
			expect(nlValue, path).toBeDefined();
			expect(placeholders(nlValue as string), path).toEqual(
				placeholders(enValue),
			);
		}
	});
});
