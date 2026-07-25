#!/usr/bin/env node
// Applies pending migrations via the verified node-pg-migrate CLI.
// User-facing surface: zero positionals, optional --dry-run only.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseStrictArgs } from "./lib/arg-parsing.mjs";
import { validateMigrationsDirectory } from "./lib/validator.mjs";
import { resolveVerifiedCli, invokeCli, isCommandExecutionFailure } from "./lib/cli-resolution.mjs";
import { NODE_PG_MIGRATE_IGNORE_PATTERN } from "./lib/constants.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

const ALLOWED_FLAGS = { "dry-run": { takesValue: false } };

function buildUpArgs(cliPath, dryRun) {
  return [
    cliPath,
    "up",
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
    ...(dryRun ? ["--dry-run"] : []),
  ];
}

async function main() {
  const parsed = parseStrictArgs(process.argv.slice(2), {
    allowedFlags: ALLOWED_FLAGS,
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

  const args = buildUpArgs(resolution.cliPath, Boolean(parsed.flags["dry-run"])).slice(1);
  const result = invokeCli(resolution.cliPath, args, repoRoot);

  if (isCommandExecutionFailure(result)) {
    console.log(
      `FAIL (none) :: MIG031_COMMAND_EXECUTION_FAILURE :: up invocation did not complete (error=${result.error ? result.error.message : "none"}, signal=${result.signal}, status=${result.status})`,
    );
    process.exitCode = 1;
    return;
  }

  process.exitCode = result.status === 0 ? 0 : 1;
  if (result.status === 0) {
    console.log("PASS migrate:up — up action exited 0");
  } else {
    console.log(`FAIL (none) :: node-pg-migrate up exited with status ${result.status}`);
  }
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      `[INTERNAL ERROR] MIG900_INTERNAL_ERROR :: migrate:up failed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
    process.exitCode = 1;
  });
}

export { main, repoRoot, buildUpArgs };
