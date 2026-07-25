// Control A — the authoritative, decisive validation rule engine. Composes
// file-discovery + header-parser + constants. Never throws for malformed
// *input*; only genuine internal exceptions (e.g. filesystem errors unrelated
// to encoding) propagate to the caller as real exceptions, which callers
// convert to MIG900_INTERNAL_ERROR.

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { scanDirectory, parseMigrationFilename } from "./file-discovery.mjs";
import { parseHeaderFields, findMarkers } from "./header-parser.mjs";
import {
  OWNING_CONTEXT_ALLOWLIST,
  DISALLOWED_PLACEHOLDER_VALUES,
  NOT_APPLICABLE_PREFIX,
} from "./constants.mjs";

function isValidUtf8(buffer) {
  return Buffer.compare(Buffer.from(buffer.toString("utf8"), "utf8"), buffer) === 0;
}

function checkNotesField(field, code, pathLabel, diagnostics) {
  if (!field) {
    diagnostics.push({ code, path: pathLabel, message: "field is missing" });
    return;
  }
  const trimmed = field.value.trim();
  if (trimmed === "") {
    diagnostics.push({ code, path: pathLabel, line: field.line, message: "field is blank" });
    return;
  }
  const lower = trimmed.toLowerCase();
  if (DISALLOWED_PLACEHOLDER_VALUES.includes(lower)) {
    diagnostics.push({
      code,
      path: pathLabel,
      line: field.line,
      message: `disallowed placeholder value "${trimmed}"`,
    });
    return;
  }
  if (lower.startsWith(NOT_APPLICABLE_PREFIX)) {
    const rest = trimmed.slice(NOT_APPLICABLE_PREFIX.length).trim();
    if (rest === "") {
      diagnostics.push({
        code,
        path: pathLabel,
        line: field.line,
        message: `"${NOT_APPLICABLE_PREFIX}" with no reason after it`,
      });
    }
  }
}

// Validates migration-mode content (header + markers) against a single
// file's text. `pathLabel` is used only for diagnostic reporting.
export function validateMigrationBody(content, pathLabel) {
  const diagnostics = [];
  const lines = content.split(/\r?\n/);
  const { fields, diagnostics: headerDiagnostics } = parseHeaderFields(lines);
  for (const d of headerDiagnostics) diagnostics.push({ ...d, path: pathLabel });

  if (!fields.owning_context) {
    diagnostics.push({
      code: "MIG011_MISSING_OWNING_CONTEXT",
      path: pathLabel,
      message: "owning_context is missing",
    });
  } else {
    const value = fields.owning_context.value;
    if (value === "" || !/^[a-z_]+$/.test(value)) {
      diagnostics.push({
        code: "MIG012_MALFORMED_OWNING_CONTEXT",
        path: pathLabel,
        line: fields.owning_context.line,
        message: `malformed owning_context value "${value}"`,
      });
    } else if (!OWNING_CONTEXT_ALLOWLIST.includes(value)) {
      diagnostics.push({
        code: "MIG013_UNKNOWN_OWNING_CONTEXT",
        path: pathLabel,
        line: fields.owning_context.line,
        message: `unknown owning_context "${value}"`,
      });
    }
  }

  if (!fields.description || fields.description.value.trim() === "") {
    diagnostics.push({
      code: "MIG014_MISSING_DESCRIPTION",
      path: pathLabel,
      message: "description is missing or blank",
    });
  }

  checkNotesField(fields.rollback_notes, "MIG015_MISSING_ROLLBACK_NOTES", pathLabel, diagnostics);
  checkNotesField(fields.forward_fix_notes, "MIG016_MISSING_FORWARDFIX_NOTES", pathLabel, diagnostics);

  const { upMarkerLine, downMarkerLine } = findMarkers(lines);
  if (upMarkerLine === -1) {
    diagnostics.push({
      code: "MIG017_MISSING_UP_MARKER",
      path: pathLabel,
      message: "-- Up Migration marker is missing",
    });
  }
  if (downMarkerLine === -1) {
    diagnostics.push({
      code: "MIG018_MISSING_DOWN_MARKER",
      path: pathLabel,
      message: "-- Down Migration marker is missing",
    });
  }
  if (upMarkerLine !== -1 && downMarkerLine !== -1 && downMarkerLine < upMarkerLine) {
    diagnostics.push({
      code: "MIG019_MARKER_ORDER_REVERSED",
      path: pathLabel,
      message: "-- Down Migration appears before -- Up Migration",
    });
  }

  return diagnostics;
}

// Validates a filename against the grammar in isolation (used by create.mjs
// to check the *intended* destination filename, which may differ from the
// temp file's actual on-disk name).
export function validateFilename(filename, pathLabel) {
  const parsed = parseMigrationFilename(filename);
  if (!parsed) {
    return [
      {
        code: "MIG005_INVALID_FILENAME",
        path: pathLabel,
        message: `"${filename}" does not match the required filename grammar`,
      },
    ];
  }
  return [];
}

// Validates migrations/template.sql: every line must be blank or start with
// "--" (after trimming). No header/filename/marker rules apply to it.
export function validateTemplateContent(content, pathLabel) {
  const diagnostics = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "" || lines[i].trimEnd().startsWith("--")) continue;
    diagnostics.push({
      code: "MIG020_TEMPLATE_EXECUTABLE_CONTENT",
      path: pathLabel,
      line: i + 1,
      message: `non-comment content found: "${lines[i]}"`,
    });
  }
  return diagnostics;
}

// Full directory scan + validation of a real (or fixture) migrations/
// directory. Returns { pass, diagnostics }.
export function validateMigrationsDirectory(migrationsDir, repoRootForLabels) {
  const diagnostics = [];
  const entries = scanDirectory(migrationsDir);
  const migrationsByPrefix = new Map();

  for (const entry of entries) {
    const pathLabel = repoRootForLabels
      ? relative(repoRootForLabels, entry.fullPath)
      : entry.fullPath;

    switch (entry.type) {
      case "directory":
        diagnostics.push({
          code: "MIG001_UNEXPECTED_DIRECTORY",
          path: pathLabel,
          message: `unexpected directory "${entry.name}" under migrations/`,
        });
        break;
      case "symlink":
        diagnostics.push({
          code: "MIG002_SYMLINK_NOT_ALLOWED",
          path: pathLabel,
          message: `symlink "${entry.name}" is not allowed under migrations/`,
        });
        break;
      case "hidden":
        diagnostics.push({
          code: "MIG003_HIDDEN_FILE_NOT_ALLOWED",
          path: pathLabel,
          message: `hidden file "${entry.name}" is not allowed under migrations/`,
        });
        break;
      case "other":
        diagnostics.push({
          code: "MIG004_UNEXPECTED_FILE_IN_MIGRATIONS_DIR",
          path: pathLabel,
          message: `unexpected file "${entry.name}" under migrations/`,
        });
        break;
      case "invalid-migration-filename":
        diagnostics.push({
          code: "MIG005_INVALID_FILENAME",
          path: pathLabel,
          message: `"${entry.name}" does not match the required filename grammar`,
        });
        break;
      case "readme":
        break;
      case "template": {
        const buffer = readFileSync(entry.fullPath);
        if (!isValidUtf8(buffer)) {
          diagnostics.push({
            code: "MIG007_NON_UTF8_CONTENT",
            path: pathLabel,
            message: "template.sql is not valid UTF-8",
          });
          break;
        }
        diagnostics.push(...validateTemplateContent(buffer.toString("utf8"), pathLabel));
        break;
      }
      case "migration": {
        if (!migrationsByPrefix.has(entry.timestampPrefix)) {
          migrationsByPrefix.set(entry.timestampPrefix, []);
        }
        migrationsByPrefix.get(entry.timestampPrefix).push({ entry, pathLabel });

        const buffer = readFileSync(entry.fullPath);
        if (!isValidUtf8(buffer)) {
          diagnostics.push({
            code: "MIG007_NON_UTF8_CONTENT",
            path: pathLabel,
            message: `"${entry.name}" is not valid UTF-8`,
          });
          break;
        }
        diagnostics.push(...validateMigrationBody(buffer.toString("utf8"), pathLabel));
        break;
      }
      default:
        break;
    }
  }

  for (const [prefix, group] of migrationsByPrefix) {
    if (group.length > 1) {
      diagnostics.push({
        code: "MIG006_DUPLICATE_SEQUENCE",
        path: group.map((g) => g.pathLabel).join(", "),
        message: `duplicate timestamp prefix "${prefix}" across: ${group
          .map((g) => g.entry.name)
          .join(", ")}`,
      });
    }
  }

  return { pass: diagnostics.length === 0, diagnostics };
}
