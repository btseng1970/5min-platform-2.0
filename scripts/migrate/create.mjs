#!/usr/bin/env node
// Repository-owned migration creation. Never invokes node-pg-migrate.
//
// Exact accepted syntax:
//   npm run migrate:create -- <slug> \
//     --owning-context=<context> \
//     --description="<text>" \
//     --rollback-notes="<text>" \
//     --forward-fix-notes="<text>"

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseStrictArgs } from "./lib/arg-parsing.mjs";
import { createMigrationFile } from "./lib/creation.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

const ALLOWED_FLAGS = {
  "owning-context": { takesValue: true },
  description: { takesValue: true },
  "rollback-notes": { takesValue: true },
  "forward-fix-notes": { takesValue: true },
};
const REQUIRED_FLAGS = ["owning-context", "description", "rollback-notes", "forward-fix-notes"];

async function main() {
  const parsed = parseStrictArgs(process.argv.slice(2), {
    allowedFlags: ALLOWED_FLAGS,
    maxPositionals: 1,
    requiredFlags: REQUIRED_FLAGS,
  });
  if (!parsed.ok) {
    console.log(`FAIL (none) :: ${parsed.code} :: ${parsed.reason}`);
    process.exitCode = 1;
    return;
  }
  if (parsed.positionals.length !== 1) {
    console.log('FAIL (none) :: MIG030_FORBIDDEN_ARGUMENT :: exactly one positional <slug> is required');
    process.exitCode = 1;
    return;
  }

  const result = createMigrationFile({
    repoRoot,
    slug: parsed.positionals[0],
    owningContext: parsed.flags["owning-context"],
    description: parsed.flags.description,
    rollbackNotes: parsed.flags["rollback-notes"],
    forwardFixNotes: parsed.flags["forward-fix-notes"],
  });

  if (!result.ok) {
    console.log(`FAIL (none) :: ${result.code} :: ${result.reason}`);
    if (result.diagnostics) {
      for (const d of result.diagnostics) {
        console.log(`FAIL ${d.path ?? "(none)"} :: ${d.code} :: ${d.message}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`PASS migrate:create — created migrations/${result.filename}`);
  process.exitCode = 0;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      `[INTERNAL ERROR] MIG900_INTERNAL_ERROR :: migrate:create failed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
    process.exitCode = 1;
  });
}

export { main, repoRoot };
