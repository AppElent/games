import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const script = fileURLToPath(new URL("./keep-env-local.mjs", import.meta.url));
const overwrite = [
	process.execPath,
	"-e",
	"require('fs').writeFileSync('.env.local', 'CONVEX_DEPLOYMENT=dev:other\\n'); process.exit(3)",
];

function run(cwd) {
	return spawnSync(process.execPath, [script, "--", ...overwrite], { cwd });
}

it("restores .env.local byte for byte and passes on the exit code", () => {
	const cwd = mkdtempSync(join(tmpdir(), "keep-env-local-"));
	const original = Buffer.from("CONVEX_DEPLOYMENT=dev:worktree\nA=1");
	writeFileSync(join(cwd, ".env.local"), original);

	const result = run(cwd);

	expect(result.status).toBe(3);
	expect(readFileSync(join(cwd, ".env.local")).equals(original)).toBe(true);
});

it("removes a .env.local the command created", () => {
	const cwd = mkdtempSync(join(tmpdir(), "keep-env-local-"));

	run(cwd);

	expect(existsSync(join(cwd, ".env.local"))).toBe(false);
});
