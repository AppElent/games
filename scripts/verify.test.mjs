import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";

const { scripts } = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

// Runs `verify` with a stub `pnpm` that logs each call and fails the step named
// by FAIL_STEP, so the chaining is tested without running the real checks.
function verify(failStep) {
	const bin = mkdtempSync(join(tmpdir(), "verify-"));
	const log = join(bin, "calls.log");
	const pnpm = join(bin, "pnpm");
	writeFileSync(
		pnpm,
		'#!/bin/sh\necho "$*" >> "$VERIFY_LOG"\n[ "$*" = "$FAIL_STEP" ] && exit 7\nexit 0\n',
	);
	chmodSync(pnpm, 0o755);
	const result = spawnSync("sh", ["-c", scripts.verify], {
		env: {
			...process.env,
			PATH: `${bin}${delimiter}${process.env.PATH}`,
			VERIFY_LOG: log,
			FAIL_STEP: failStep ?? "",
		},
	});
	let calls = [];
	try {
		calls = readFileSync(log, "utf8").trim().split("\n");
	} catch {}
	return { status: result.status, calls };
}

const steps = ["run check", "run typecheck", "test"];

describe("pnpm verify", () => {
	it("runs lint, typecheck and tests through the existing scripts", () => {
		expect(scripts.check).toMatch(/^biome check\b/);
		expect(verify()).toEqual({ status: 0, calls: steps });
	});

	it.each(steps)("fails and stops when `pnpm %s` fails", (step) => {
		const { status, calls } = verify(step);

		expect(status).toBe(7);
		expect(calls).toEqual(steps.slice(0, steps.indexOf(step) + 1));
	});
});
