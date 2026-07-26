// Repository-owned migration creation. Never invokes node-pg-migrate.
// Temp working directory lives under <repoRoot>/.fnd003-migrate-create-*,
// never under node:os's tmpdir() (not imported anywhere in this file).
// Places the validated file atomically via linkSync (never renameSync,
// which would silently overwrite an existing destination). Never deletes,
// truncates, overwrites, or renames an existing migration file.

import {
  lstatSync,
  statSync,
  realpathSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  linkSync,
  unlinkSync,
  rmSync,
} from "node:fs";
import { join, relative, basename, isAbsolute } from "node:path";
import {
  TEMP_DIR_PREFIX,
  SLUG_REGEX,
  MAX_SLUG_LENGTH,
  TEMPLATE_FILENAME,
  HEADER_FIELDS,
} from "./constants.mjs";
import { validateFilename, validateMigrationBody } from "./validator.mjs";

export function computeUtcTimestamp(date = new Date()) {
  const pad = (n, width = 2) => String(n).padStart(width, "0");
  return (
    pad(date.getUTCFullYear(), 4) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

// Lowercases, collapses runs of non-[a-z0-9] to a single "-", strips
// leading/trailing "-". Returns null if the normalized result is empty or
// exceeds MAX_SLUG_LENGTH.
export function normalizeSlug(rawSlug) {
  const normalized = rawSlug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized === "" || !SLUG_REGEX.test(normalized)) return null;
  if (normalized.length > MAX_SLUG_LENGTH) return null;
  return normalized;
}

// Steps 3-5: verify repoRoot and migrations/ are real, non-symlinked
// directories, and that migrations/ is genuinely contained within repoRoot.
export function verifyRepoRootAndMigrationsDir(repoRoot) {
  let realRepoRoot;
  try {
    if (lstatSync(repoRoot).isSymbolicLink()) {
      return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: `repoRoot is a symlink: ${repoRoot}` };
    }
    realRepoRoot = realpathSync(repoRoot);
    if (!statSync(realRepoRoot).isDirectory()) {
      return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: `repoRoot is not a directory: ${repoRoot}` };
    }
  } catch (err) {
    return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: `repoRoot verification failed: ${err.message}` };
  }

  const migrationsDirPath = join(repoRoot, "migrations");
  let realMigrationsDir;
  try {
    if (lstatSync(migrationsDirPath).isSymbolicLink()) {
      return { ok: false, code: "MIG002_SYMLINK_NOT_ALLOWED", reason: `migrations/ is a symlink: ${migrationsDirPath}` };
    }
    realMigrationsDir = realpathSync(migrationsDirPath);
    if (!statSync(realMigrationsDir).isDirectory()) {
      return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: `migrations/ is not a directory: ${migrationsDirPath}` };
    }
  } catch (err) {
    return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: `migrations/ verification failed: ${err.message}` };
  }

  const rel = relative(realRepoRoot, realMigrationsDir);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: `migrations/ is not contained within repoRoot` };
  }

  return { ok: true, realRepoRoot, realMigrationsDir };
}

// Step 7: scan migrations/ for any existing entry (of any kind) whose name
// starts with the exact timestamp prefix, regardless of slug. The
// uniqueness key is the prefix, not the full filename.
export function checkPrefixCollision(realMigrationsDir, timestampPrefix) {
  const names = readdirSync(realMigrationsDir);
  const matches = names.filter((name) => name.startsWith(`${timestampPrefix}_`) || name === `${timestampPrefix}`);
  return { collides: matches.length > 0, matches };
}

function substituteTemplatePlaceholders(templateContent, values) {
  const lines = templateContent.split(/\r?\n/);
  const replaced = lines.map((line) => {
    for (const field of HEADER_FIELDS) {
      if (line.startsWith(`-- ${field}:`)) {
        return `-- ${field}: ${values[field]}`;
      }
    }
    return line;
  });
  return replaced.join("\n");
}

// The full 18-step safe creation flow. `repoRoot` is overridable so tests
// can point this at an isolated scratch directory tree.
export function createMigrationFile({
  repoRoot,
  slug,
  owningContext,
  description,
  rollbackNotes,
  forwardFixNotes,
}) {
  const normalizedSlug = normalizeSlug(slug);
  if (normalizedSlug === null) {
    return { ok: false, code: "MIG032_SLUG_INVALID", reason: `slug "${slug}" is empty after normalization or exceeds ${MAX_SLUG_LENGTH} characters` };
  }

  const containment = verifyRepoRootAndMigrationsDir(repoRoot);
  if (!containment.ok) return containment;
  const { realRepoRoot, realMigrationsDir } = containment;

  const timestampPrefix = computeUtcTimestamp();
  const filename = `${timestampPrefix}_${normalizedSlug}.sql`;
  const destPath = join(realMigrationsDir, filename);

  const collision = checkPrefixCollision(realMigrationsDir, timestampPrefix);
  if (collision.collides) {
    return {
      ok: false,
      code: "MIG033_DESTINATION_ALREADY_EXISTS",
      reason: `timestamp prefix "${timestampPrefix}" already exists: ${collision.matches.join(", ")}`,
    };
  }

  let tempDir;
  try {
    tempDir = mkdtempSync(join(realRepoRoot, TEMP_DIR_PREFIX));
  } catch (err) {
    return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: `failed to create temp directory: ${err.message}` };
  }

  let realTempDir;
  let verifiedTemp = false;
  try {
    realTempDir = realpathSync(tempDir);
    const rel = relative(realRepoRoot, realTempDir);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: "temp directory escapes repoRoot containment" };
    }
    if (!basename(realTempDir).startsWith(TEMP_DIR_PREFIX)) {
      return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: "temp directory basename does not match the expected prefix" };
    }
    verifiedTemp = true;

    const tempFilePath = join(realTempDir, filename);
    const templateContent = readFileSync(join(realMigrationsDir, TEMPLATE_FILENAME), "utf8");
    const populated = substituteTemplatePlaceholders(templateContent, {
      owning_context: owningContext,
      description,
      rollback_notes: rollbackNotes,
      forward_fix_notes: forwardFixNotes,
    });

    writeFileSync(tempFilePath, populated, { encoding: "utf8", flag: "wx" });

    const diagnostics = [
      ...validateFilename(filename, filename),
      ...validateMigrationBody(populated, filename),
    ];
    if (diagnostics.length > 0) {
      return { ok: false, code: diagnostics[0].code, reason: diagnostics[0].message, diagnostics };
    }

    try {
      linkSync(tempFilePath, destPath);
    } catch (err) {
      if (err.code === "EEXIST") {
        return { ok: false, code: "MIG033_DESTINATION_ALREADY_EXISTS", reason: `destination already exists: ${destPath}` };
      }
      return { ok: false, code: "MIG034_ATOMIC_MOVE_FAILURE", reason: `linkSync failed: ${err.message}` };
    }

    unlinkSync(tempFilePath);

    return { ok: true, destPath, filename };
  } catch (err) {
    return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: err.message };
  } finally {
    // Only clean up a temp directory that passed containment/prefix
    // verification — an unverified path is never recursively deleted.
    if (verifiedTemp) {
      try {
        rmSync(realTempDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup; a cleanup failure does not change the
        // already-determined success/failure result of this invocation.
      }
    }
  }
}
