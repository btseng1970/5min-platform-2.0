#!/usr/bin/env node
// Control A entrypoint. Validates the real migrations/ directory. Never
// touches node-pg-migrate, never accesses a database.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateMigrationsDirectory } from "./lib/validator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

async function main() {
  const migrationsDir = join(repoRoot, "migrations");
  const { pass, diagnostics } = validateMigrationsDirectory(migrationsDir, repoRoot);

  if (pass) {
    console.log("PASS migrate:validate — 0 violations");
    process.exitCode = 0;
    return;
  }

  for (const d of diagnostics) {
    console.log(`FAIL ${d.path ?? "(none)"} :: ${d.code} :: ${d.message}`);
  }
  process.exitCode = 1;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      `[INTERNAL ERROR] MIG900_INTERNAL_ERROR :: migrate:validate failed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
    process.exitCode = 1;
  });
}

export { main, repoRoot };
