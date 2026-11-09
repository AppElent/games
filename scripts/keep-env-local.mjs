/**
 * Runs a command and puts `.env.local` back exactly as it was afterwards.
 *
 *   node scripts/keep-env-local.mjs -- pnpm exec convex dev --once
 *
 * `convex dev` always rewrites `.env.local` for the deployment it pushed to:
 * `CONVEX_DEPLOYMENT` and the client URL, but not a scoped deploy key. In a
 * prepared worktree that would leave local commands on mixed backends after
 * `deploy:dev`, so the deploy runs through this wrapper. Convex 1.49 has no
 * flag for this: `--env-file` changes which deployment is chosen, not which
 * file is written.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const FILE = ".env.local";

const separator = process.argv.indexOf("--");
const [command, ...args] =
	separator === -1 ? [] : process.argv.slice(separator + 1);
if (!command) {
	console.error("Usage: node scripts/keep-env-local.mjs -- <command> [args]");
	process.exit(2);
}

const snapshot = existsSync(FILE) ? readFileSync(FILE) : null;

// The child gets Ctrl-C itself; the wrapper waits so it can still restore.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
	process.on(signal, () => {});

const result = spawnSync(command, args, { stdio: "inherit" });

if (snapshot === null) rmSync(FILE, { force: true });
else writeFileSync(FILE, snapshot);

if (result.error) {
	console.error(`${command}: ${result.error.message}`);
	process.exit(1);
}
process.exit(result.status ?? 1);
