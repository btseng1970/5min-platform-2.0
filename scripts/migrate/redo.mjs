#!/usr/bin/env node
// Repository-owned redo orchestration. node-pg-migrate@8.0.4's own `redo`
// action does not guarantee reapplying exactly one migration (its up-half is
// hardcoded to Number.POSITIVE_INFINITY — confirmed directly from the exact
// 8.0.4 artifact's bin/node-pg-migrate.js, lines 460-466/473/512-514: a plain
// `up`/`down` action calls migrationRunner(options(action)) with no count
// override, so `count` is exactly the shared positional argument; only
// `redo` overrides its up-half to Number.POSITIVE_INFINITY). This file
// therefore NEVER constructs or passes the literal action string "redo" to
// node-pg-migrate. It orchestrates exactly two independently-invoked
// actions: `down 1`, then — only if that exits 0 — `up 1`.
//
// User-facing surface: zero arguments of any kind.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseStrictArgs } from "./lib/arg-parsing.mjs";
import { validateMigrationsDirectory } from "./lib/validator.mjs";
import { resolveVerifiedCli, invokeCli, isCommandExecutionFailure } from "./lib/cli-resolution.mjs";
import { NODE_PG_MIGRATE_IGNORE_PATTERN } from "./lib/constants.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

const RECOVERY_MESSAGE =
  "redo's down-half succeeded and the database was rolled back; the up-half " +
  "failed to reapply the migration; the database currently remains at the " +
  "down (rolled-back) state; inspect the up-half's output above, resolve " +
  "the underlying issue, and re-run `npm run migrate:up` manually to " +
  "reapply — do not assume the migration is still active.";

export function buildRedoDownArgs(cliPath) {
  return [
    cliPath,
    "down",
    "1",
    "--database-url-var",
    "DATABASE_URL",
    "--migrations-dir",
    "migrations",
    "--ignore-pattern",
    NODE_PG_MIGRATE_IGNORE_PATTERN,
    "--migrations-table",
    "pgmigrations",
    "--schema",
    "public",
    "--single-transaction",
    "--lock",
    "--check-order",
    "--verbose",
  ];
}

export function buildRedoUpArgs(cliPath) {
  return [
    cliPath,
    "up",
    "1",
    "--database-url-var",
    "DATABASE_URL",
    "--migrations-dir",
    "migrations",
    "--ignore-pattern",
    NODE_PG_MIGRATE_IGNORE_PATTERN,
    "--migrations-table",
    "pgmigrations",
    "--schema",
    "public",
    "--single-transaction",
    "--lock",
    "--check-order",
    "--verbose",
  ];
}

// Testable orchestration core. `invoke(cliPath, args, repoRoot)` defaults to
// the real invokeCli but is injectable so tests can simulate down/up
// success/failure without spawning a real process or touching a database.
// No claim is made that the two invocations form one atomic transaction —
// each is its own separate node-pg-migrate process and database transaction.
export function runRedoOrchestration({ cliPath, repoRoot: root, invoke = invokeCli }) {
  const downFullArgs = buildRedoDownArgs(cliPath);
  const downArgs = downFullArgs.slice(1);
  const downResult = invoke(cliPath, downArgs, root);

  if (isCommandExecutionFailure(downResult)) {
    return {
      ok: false,
      code: "MIG031_COMMAND_EXECUTION_FAILURE",
      reason: `down invocation did not complete (error=${downResult.error ? downResult.error.message : "none"}, signal=${downResult.signal}, status=${downResult.status})`,
      stage: "down",
    };
  }
  if (downResult.status !== 0) {
    return {
      ok: false,
      code: null,
      reason: `down exited with status ${downResult.status}`,
      stage: "down",
    };
  }

  const upFullArgs = buildRedoUpArgs(cliPath);
  const upArgs = upFullArgs.slice(1);
  const upResult = invoke(cliPath, upArgs, root);

  if (isCommandExecutionFailure(upResult) || upResult.status !== 0) {
    return {
      ok: false,
      code: "MIG035_REDO_PARTIAL_FAILURE",
      reason: RECOVERY_MESSAGE,
      stage: "up",
    };
  }

  return { ok: true };
}

async function main() {
  const parsed = parseStrictArgs(process.argv.slice(2), {
    allowedFlags: {},
    maxPositionals: 0,
    requiredFlags: [],
  });
  if (!parsed.ok) {
    console.log(`FAIL (none) :: ${parsed.code} :: ${parsed.reason}`);
    process.exitCode = 1;
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.log("FAIL (none) :: MIG029_MISSING_DATABASE_URL :: DATABASE_URL is not set");
    process.exitCode = 1;
    return;
  }

  const { pass, diagnostics } = validateMigrationsDirectory(join(repoRoot, "migrations"), repoRoot);
  if (!pass) {
    for (const d of diagnostics) {
      console.log(`FAIL ${d.path ?? "(none)"} :: ${d.code} :: ${d.message}`);
    }
    process.exitCode = 1;
    return;
  }

  const resolution = resolveVerifiedCli(repoRoot);
  if (!resolution.ok) {
    console.log(`[INTERNAL ERROR] ${resolution.code} :: ${resolution.reason}`);
    process.exitCode = 1;
    return;
  }

  const outcome = runRedoOrchestration({ cliPath: resolution.cliPath, repoRoot });

  if (!outcome.ok) {
    if (outcome.code) {
      console.log(`FAIL (none) :: ${outcome.code} :: ${outcome.reason}`);
    } else {
      console.log(`FAIL (none) :: ${outcome.reason}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("PASS migrate:redo — down (1) then up (1) both exited 0");
  process.exitCode = 0;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      `[INTERNAL ERROR] MIG900_INTERNAL_ERROR :: migrate:redo failed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
    process.exitCode = 1;
  });
}

export { main, repoRoot };
