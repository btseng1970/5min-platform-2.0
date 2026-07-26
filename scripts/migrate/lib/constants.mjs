// Shared constants for the FND-003 migration framework: filename grammar,
// header grammar, the owning_context allowlist, node-pg-migrate identity
// requirements, and the full diagnostic-code inventory. No logic here —
// values only, imported by every other scripts/migrate/** module.

export const NODE_PG_MIGRATE_PACKAGE_NAME = "node-pg-migrate";
export const NODE_PG_MIGRATE_VERSION = "8.0.4";
export const NODE_PG_MIGRATE_BIN_KEY = "node-pg-migrate";
export const NODE_PG_MIGRATE_BIN_TARGET = "bin/node-pg-migrate.js";

// node-pg-migrate@8.0.4's default migrations-directory scan excludes only
// dotfiles (its own default ignore regexp is exactly /^\..*$/) and passes
// every other file to a dynamic import() unless its extension is exactly
// .sql — crashing with ERR_UNKNOWN_FILE_EXTENSION on migrations/README.md,
// a permanent, non-migration file (Gate C §11). This fixed, exact,
// non-overridable --ignore-pattern excludes exactly README.md and
// template.sql (anchored, case-sensitive, exact basenames only) and is not a
// substitute for Control A (lib/validator.mjs), which remains the sole
// authoritative validator and still runs before CLI resolution/invocation.
export const NODE_PG_MIGRATE_IGNORE_PATTERN = "^(README\\.md|template\\.sql)$";

export const TEMP_DIR_PREFIX = ".fnd003-migrate-create-";

// Owning-context allowlist: `platform` plus the 11 domain names.
// Source: docs/codex-spec-revb1.docx.md:99,212 ("platform + 11 domain
// schemas, 合計 12 schemas") and docs/codex-task-packages/FND-002.md:11
// (exact 11 domain names). foundation/shared/core/system are not permitted —
// no repository document defines any of them as a valid owning context.
export const OWNING_CONTEXT_ALLOWLIST = Object.freeze([
  "platform",
  "campaign",
  "wallet",
  "qr",
  "reward",
  "notification",
  "compliance",
  "crm",
  "team",
  "ip_asset",
  "analytics",
  "commerce",
]);

export const HEADER_FIELDS = Object.freeze([
  "owning_context",
  "description",
  "rollback_notes",
  "forward_fix_notes",
]);

// Fields where a bare placeholder value is rejected (case-insensitive exact
// match after trimming). Applies to rollback_notes / forward_fix_notes.
export const DISALLOWED_PLACEHOLDER_VALUES = Object.freeze([
  "n/a",
  "na",
  "none",
  "tbd",
  "later",
  "todo",
  "blank",
]);

export const NOT_APPLICABLE_PREFIX = "not_applicable:";

export const UP_MARKER = "-- Up Migration";
export const DOWN_MARKER = "-- Down Migration";

// Filename grammar: YYYYMMDDHHMMSS_<slug>.sql (UTC timestamp prefix is the
// uniqueness key, not the full filename).
export const FILENAME_REGEX = /^(\d{14})_([a-z0-9]+(?:-[a-z0-9]+)*)\.sql$/;
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 60;

export const README_FILENAME = "README.md";
export const TEMPLATE_FILENAME = "template.sql";

// Complete, contiguous diagnostic-code inventory: MIG001-MIG035 + MIG900.
export const DIAGNOSTIC_CODES = Object.freeze({
  MIG001_UNEXPECTED_DIRECTORY: "A subdirectory exists under migrations/",
  MIG002_SYMLINK_NOT_ALLOWED: "An entry under migrations/ (or migrations/ itself) is a symlink",
  MIG003_HIDDEN_FILE_NOT_ALLOWED: "An entry under migrations/ is a dotfile",
  MIG004_UNEXPECTED_FILE_IN_MIGRATIONS_DIR: "A file is not README.md, template.sql, or a grammar-valid migration",
  MIG005_INVALID_FILENAME: "Filename does not match the required grammar",
  MIG006_DUPLICATE_SEQUENCE: "Two or more files share the same 14-digit timestamp prefix",
  MIG007_NON_UTF8_CONTENT: "A migration file cannot be decoded as valid UTF-8",
  MIG008_HEADER_PARSE_FAILURE: "A header-block line starts with -- but has no : separator",
  MIG009_DUPLICATE_HEADER_FIELD: "A header field key appears more than once",
  MIG010_UNKNOWN_HEADER_FIELD: "A header-block line uses a key outside the four allowed keys",
  MIG011_MISSING_OWNING_CONTEXT: "owning_context absent",
  MIG012_MALFORMED_OWNING_CONTEXT: "owning_context value outside [a-z_], or a template placeholder in a migration-classified file",
  MIG013_UNKNOWN_OWNING_CONTEXT: "owning_context well-formed but not in the allowlist",
  MIG014_MISSING_DESCRIPTION: "description absent or blank",
  MIG015_MISSING_ROLLBACK_NOTES: "rollback_notes absent, blank, or a disallowed placeholder",
  MIG016_MISSING_FORWARDFIX_NOTES: "forward_fix_notes absent, blank, or a disallowed placeholder",
  MIG017_MISSING_UP_MARKER: "-- Up Migration marker absent",
  MIG018_MISSING_DOWN_MARKER: "-- Down Migration marker absent",
  MIG019_MARKER_ORDER_REVERSED: "-- Down Migration appears before -- Up Migration",
  MIG020_TEMPLATE_EXECUTABLE_CONTENT: "migrations/template.sql contains a non-blank, non---prefixed line",
  MIG021_CLI_NOT_FOUND: "node_modules/node-pg-migrate/package.json missing or unparseable",
  MIG022_CLI_WRONG_PACKAGE_NAME: "Resolved name is not exactly node-pg-migrate",
  MIG023_CLI_WRONG_VERSION: "Resolved version is not exactly 8.0.4",
  MIG024_CLI_WRONG_BIN_KEY: "bin missing, not an object, or lacks a node-pg-migrate key",
  MIG025_CLI_WRONG_BIN_TARGET: "bin[node-pg-migrate] is not exactly bin/node-pg-migrate.js, or doesn't exist",
  MIG026_CLI_PATH_ESCAPE: "Resolved CLI realpath falls outside the resolved package directory",
  MIG027_CLI_NOT_REGULAR_FILE: "Resolved CLI path exists but is not a regular file",
  MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME: "--version output does not equal 8.0.4 exactly",
  MIG029_MISSING_DATABASE_URL: "DATABASE_URL unset when up/down/redo is invoked",
  MIG030_FORBIDDEN_ARGUMENT: "Caller passed an argument not on the invoking wrapper's exact allowlist",
  MIG031_COMMAND_EXECUTION_FAILURE: "A spawnSync call did not run to completion (error/signal/null status)",
  MIG032_SLUG_INVALID: "migrate:create's slug is empty after normalization or exceeds 60 characters",
  MIG033_DESTINATION_ALREADY_EXISTS: "migrate:create's computed destination (or its timestamp prefix) already exists",
  MIG034_ATOMIC_MOVE_FAILURE: "migrate:create's linkSync placement failed for a reason other than EEXIST",
  MIG035_REDO_PARTIAL_FAILURE: "redo.mjs's down-half succeeded but the up-half failed",
  MIG900_INTERNAL_ERROR: "Any exception not otherwise classified",
});
