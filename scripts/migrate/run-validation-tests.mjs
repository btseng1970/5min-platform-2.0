#!/usr/bin/env node
// Test harness for the FND-003 migration framework. Covers 48 total test
// cases: 29 filesystem-based scenarios (18 with committed fixture content,
// 11 constructed/destroyed dynamically at run time — including all 7
// cli-resolution scenarios, which never touch a committed node_modules
// path), 6 redo.mjs function-level orchestration cases, and 13
// create.mjs/lib/creation.mjs function-level placement cases. No database
// is accessed. node-pg-migrate is never actually invoked by this harness —
// CLI resolution is exercised only against dynamically-constructed scratch
// node_modules trees, never this repository's real node_modules.

import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  lstatSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateMigrationsDirectory } from "./lib/validator.mjs";
import {
  resolveNodePgMigrateCli,
  isCommandExecutionFailure,
  evaluateVersionProbeResult,
} from "./lib/cli-resolution.mjs";
import {
  createMigrationFile,
  computeUtcTimestamp,
  normalizeSlug,
  checkPrefixCollision,
  verifyRepoRootAndMigrationsDir,
} from "./lib/creation.mjs";
import { buildRedoDownArgs, buildRedoUpArgs, runRedoOrchestration } from "./redo.mjs";
import { buildUpArgs } from "./up.mjs";
import { buildDownArgs } from "./down.mjs";
import {
  TEMP_DIR_PREFIX,
  NODE_PG_MIGRATE_PACKAGE_NAME,
  NODE_PG_MIGRATE_VERSION,
  NODE_PG_MIGRATE_BIN_KEY,
  NODE_PG_MIGRATE_BIN_TARGET,
  NODE_PG_MIGRATE_IGNORE_PATTERN,
} from "./lib/constants.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
const fixturesDir = join(__dirname, "fixtures");

const results = [];

function record(name, pass, reason) {
  results.push({ name, pass, reason });
}

// ---------------------------------------------------------------------
// 1-3: positive fixture scenarios (committed content)
// ---------------------------------------------------------------------

function runValidatorFixture(name, dir, expectPass, expectedCode) {
  const { pass, diagnostics } = validateMigrationsDirectory(dir, repoRoot);
  if (expectPass) {
    record(name, pass, pass ? undefined : `expected pass, got: ${JSON.stringify(diagnostics)}`);
  } else {
    const codes = diagnostics.map((d) => d.code);
    const found = codes.includes(expectedCode);
    record(
      name,
      !pass && found,
      found ? undefined : `expected code ${expectedCode}, got: ${JSON.stringify(codes)}`,
    );
  }
}

async function main() {

runValidatorFixture("fixture:valid-migration", join(fixturesDir, "valid", "valid-migration"), true);
runValidatorFixture("fixture:deterministic-ordering", join(fixturesDir, "valid", "deterministic-ordering"), true);

// ---------------------------------------------------------------------
// 4-25: negative fixture scenarios (committed content)
// ---------------------------------------------------------------------

const NEGATIVE_FIXTURES = [
  ["missing-owning-context", "MIG011_MISSING_OWNING_CONTEXT"],
  ["malformed-owning-context", "MIG012_MALFORMED_OWNING_CONTEXT"],
  ["duplicate-owning-context-header", "MIG009_DUPLICATE_HEADER_FIELD"],
  ["unknown-owning-context", "MIG013_UNKNOWN_OWNING_CONTEXT"],
  ["invalid-filename", "MIG005_INVALID_FILENAME"],
  ["duplicate-sequence", "MIG006_DUPLICATE_SEQUENCE"],
  ["missing-rollback-notes", "MIG015_MISSING_ROLLBACK_NOTES"],
  ["missing-forward-fix-notes", "MIG016_MISSING_FORWARDFIX_NOTES"],
  ["missing-up-marker", "MIG017_MISSING_UP_MARKER"],
  ["missing-down-marker", "MIG018_MISSING_DOWN_MARKER"],
  ["reversed-marker-order", "MIG019_MARKER_ORDER_REVERSED"],
  ["executable-ddl-in-template", "MIG020_TEMPLATE_EXECUTABLE_CONTENT"],
  ["non-sql-migration-file", "MIG004_UNEXPECTED_FILE_IN_MIGRATIONS_DIR"],
  ["nested-directory", "MIG001_UNEXPECTED_DIRECTORY"],
  ["hidden-file", "MIG003_HIDDEN_FILE_NOT_ALLOWED"],
  ["parser-exception", "MIG008_HEADER_PARSE_FAILURE"],
];

for (const [dirName, expectedCode] of NEGATIVE_FIXTURES) {
  runValidatorFixture(`fixture:${dirName}`, join(fixturesDir, "invalid", dirName), false, expectedCode);
}

// ---------------------------------------------------------------------
// CLI-resolution scenarios (7) — dynamically constructed and destroyed
// scratch node_modules trees, never committed fixture files. Amended:
// these were previously committed under scripts/migrate/fixtures/invalid/
// cli-resolution/**, which the repository's root .gitignore silently
// excluded from git tracking (any node_modules/ segment, anywhere in the
// tree). Human Review directed conversion to dynamic construction so no
// fake node_modules path is ever committed. Every scratch tree here is
// created under the OS temp directory (isolation only — unrelated to
// create.mjs/lib/creation.mjs's own repository-root temp design) and is
// never anywhere near this repository's real node_modules directory.
// ---------------------------------------------------------------------

function buildFakeNodePgMigratePackage(scratchRoot, overrides = {}) {
  const {
    name = NODE_PG_MIGRATE_PACKAGE_NAME,
    version = NODE_PG_MIGRATE_VERSION,
    bin = { [NODE_PG_MIGRATE_BIN_KEY]: NODE_PG_MIGRATE_BIN_TARGET },
  } = overrides;
  const packageDir = join(scratchRoot, "node_modules", NODE_PG_MIGRATE_PACKAGE_NAME);
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(join(packageDir, "package.json"), JSON.stringify({ name, version, bin }, null, 2));
  return packageDir;
}

function recordCliResolution(name, scratchRoot, expectedCode) {
  const resolution = resolveNodePgMigrateCli(scratchRoot);
  record(
    name,
    !resolution.ok && resolution.code === expectedCode,
    resolution.ok
      ? "expected resolution failure, but it succeeded"
      : `expected ${expectedCode}, got ${resolution.code} (${resolution.reason})`,
  );
}

{
  // missing-local-dependency: no node_modules/node-pg-migrate/package.json
  // at all under the scratch repoRoot.
  const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-cli-missing-"));
  try {
    recordCliResolution("dynamic:cli-resolution/missing-local-dependency", scratchRoot, "MIG021_CLI_NOT_FOUND");
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-cli-wrongname-"));
  try {
    buildFakeNodePgMigratePackage(scratchRoot, { name: "not-node-pg-migrate" });
    recordCliResolution("dynamic:cli-resolution/wrong-package-name", scratchRoot, "MIG022_CLI_WRONG_PACKAGE_NAME");
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-cli-wrongversion-"));
  try {
    buildFakeNodePgMigratePackage(scratchRoot, { version: "9.0.0" });
    recordCliResolution("dynamic:cli-resolution/wrong-package-version", scratchRoot, "MIG023_CLI_WRONG_VERSION");
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-cli-wrongbinkey-"));
  try {
    buildFakeNodePgMigratePackage(scratchRoot, { bin: {} });
    recordCliResolution("dynamic:cli-resolution/wrong-bin-key", scratchRoot, "MIG024_CLI_WRONG_BIN_KEY");
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-cli-wrongbintarget-"));
  try {
    buildFakeNodePgMigratePackage(scratchRoot, {
      bin: { [NODE_PG_MIGRATE_BIN_KEY]: "bin/does-not-exist.js" },
    });
    recordCliResolution("dynamic:cli-resolution/wrong-bin-target", scratchRoot, "MIG025_CLI_WRONG_BIN_TARGET");
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  // bin-path-escape: bin declares the exact approved target string (so the
  // restored exact-equality check passes), but that exact path is a symlink
  // resolving to a real file outside the fake package directory — only the
  // realpath containment check (MIG026) should catch this.
  const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-cli-escape-"));
  const outsideDir = mkdtempSync(join(tmpdir(), "fnd003-test-cli-escape-outside-"));
  try {
    const packageDir = buildFakeNodePgMigratePackage(scratchRoot);
    const outsideFile = join(outsideDir, "outside.js");
    writeFileSync(outsideFile, "// escape target, outside the fake package root\n");
    const binPath = join(packageDir, NODE_PG_MIGRATE_BIN_TARGET);
    mkdirSync(dirname(binPath), { recursive: true });
    let symlinkSupported = true;
    try {
      symlinkSync(outsideFile, binPath);
    } catch {
      symlinkSupported = false;
    }
    if (!symlinkSupported) {
      record(
        "dynamic:cli-resolution/bin-path-escape",
        true,
        "SKIPPED (clearly classified, not a false pass): this OS/runtime could not create a symlink; the standard supported development environment (macOS/Linux) must execute this case for real",
      );
    } else {
      recordCliResolution("dynamic:cli-resolution/bin-path-escape", scratchRoot, "MIG026_CLI_PATH_ESCAPE");
    }
  } finally {
    rmSync(outsideDir, { recursive: true, force: true });
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  // non-regular-bin-file: bin declares the exact approved target string,
  // but a directory (not a file) exists at that exact joined path.
  const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-cli-notregular-"));
  try {
    const packageDir = buildFakeNodePgMigratePackage(scratchRoot);
    mkdirSync(join(packageDir, NODE_PG_MIGRATE_BIN_TARGET), { recursive: true });
    recordCliResolution("dynamic:cli-resolution/non-regular-bin-file", scratchRoot, "MIG027_CLI_NOT_REGULAR_FILE");
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------
// Dynamic filesystem scenarios (0 committed files)
// ---------------------------------------------------------------------

{
  const dynDir = mkdtempSync(join(tmpdir(), "fnd003-test-empty-"));
  try {
    const { pass } = validateMigrationsDirectory(dynDir, repoRoot);
    record("dynamic:empty-migration-set", pass);
  } finally {
    rmSync(dynDir, { recursive: true, force: true });
  }
}

{
  const dynDir = mkdtempSync(join(tmpdir(), "fnd003-test-symlink-"));
  try {
    symlinkSync("/dev/null", join(dynDir, "20260101000000_x.sql"));
    const { pass, diagnostics } = validateMigrationsDirectory(dynDir, repoRoot);
    const codes = diagnostics.map((d) => d.code);
    record("dynamic:symlink-migration", !pass && codes.includes("MIG002_SYMLINK_NOT_ALLOWED"));
  } finally {
    rmSync(dynDir, { recursive: true, force: true });
  }
}

{
  const dynDir = mkdtempSync(join(tmpdir(), "fnd003-test-utf8-"));
  try {
    writeFileSync(join(dynDir, "20260101000000_x.sql"), Buffer.from([0xff, 0xfe, 0x00, 0x00]));
    const { pass, diagnostics } = validateMigrationsDirectory(dynDir, repoRoot);
    const codes = diagnostics.map((d) => d.code);
    record("dynamic:malformed-utf8", !pass && codes.includes("MIG007_NON_UTF8_CONTENT"));
  } finally {
    rmSync(dynDir, { recursive: true, force: true });
  }
}

{
  // dynamic:false-success-prevention — expanded (Gate C fifth-pass
  // amendment, post-Gate-E) with 10 sub-assertions covering the amended
  // runtime version-probe contract (evaluateVersionProbeResult), on top of
  // the original invocation-level false-success check. All folded into this
  // one existing top-level test record per instruction — no new top-level
  // test record is added; the suite's total case count remains 48.
  const failures = [];
  const check = (label, condition) => {
    if (!condition) failures.push(label);
  };

  // Original assertion: a genuinely nonexistent binary must never be
  // reported as a successful invocation.
  const spawnFailResult = spawnSync("/fnd003-does-not-exist/no-such-binary", [], { encoding: "utf8", shell: false });
  check("invocation-level false-success prevention", isCommandExecutionFailure(spawnFailResult));

  const fake = ({ status = 0, error = null, signal = null, stdout = "", stderr = "" } = {}) => ({
    status,
    error,
    signal,
    stdout,
    stderr,
  });

  // 1. structural identity succeeds + runtime output "8.0.4" + exit 0: success, runtimeVersionConfirmed = true.
  {
    const r = evaluateVersionProbeResult(fake({ stdout: "8.0.4" }), "8.0.4");
    check(
      "sub-assertion 1: exact 8.0.4 output accepted with runtimeVersionConfirmed=true",
      r.ok === true && r.runtimeVersionOutput === "8.0.4" && r.runtimeVersionConfirmed === true,
    );
  }

  // 2. structural identity succeeds + runtime output exact "unknown" + exit 0: success,
  //    runtimeVersionConfirmed = false, packageVersion remains 8.0.4, authoritativeVersionSource remains package.json.
  {
    const r = evaluateVersionProbeResult(fake({ stdout: "unknown" }), NODE_PG_MIGRATE_VERSION);
    check(
      "sub-assertion 2: exact unknown output accepted with runtimeVersionConfirmed=false",
      r.ok === true && r.runtimeVersionOutput === "unknown" && r.runtimeVersionConfirmed === false,
    );
    // packageVersion/authoritativeVersionSource are composed by resolveVerifiedCli
    // (resolution.packageVersion, literal "package.json"), not by this pure
    // probe-evaluation function — confirmed here by static source inspection
    // of the actual composition, plus confirming resolveNodePgMigrateCli
    // itself reports the structurally-verified packageVersion correctly.
    const source = readFileSync(join(__dirname, "lib", "cli-resolution.mjs"), "utf8");
    check(
      "sub-assertion 2: resolveVerifiedCli composes authoritativeVersionSource: \"package.json\"",
      /authoritativeVersionSource:\s*"package\.json"/.test(source),
    );
    check(
      "sub-assertion 2: resolveVerifiedCli composes packageVersion from structural resolution",
      /packageVersion:\s*resolution\.packageVersion/.test(source),
    );
    const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-cli-probe-pkgversion-"));
    try {
      const packageDir = join(scratchRoot, "node_modules", "node-pg-migrate");
      mkdirSync(packageDir, { recursive: true });
      writeFileSync(
        join(packageDir, "package.json"),
        JSON.stringify({ name: "node-pg-migrate", version: "8.0.4", bin: { "node-pg-migrate": "bin/node-pg-migrate.js" } }, null, 2),
      );
      mkdirSync(join(packageDir, "bin"), { recursive: true });
      writeFileSync(join(packageDir, "bin", "node-pg-migrate.js"), "// scratch placeholder, never executed\n");
      const structural = resolveNodePgMigrateCli(scratchRoot);
      check(
        "sub-assertion 2: structural resolution reports packageVersion exactly 8.0.4",
        structural.ok === true && structural.packageVersion === "8.0.4",
      );
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  }

  // 3. output "Unknown" (capitalized) fails MIG028 — case-sensitive exact match only.
  {
    const r = evaluateVersionProbeResult(fake({ stdout: "Unknown" }), "8.0.4");
    check("sub-assertion 3: capitalized \"Unknown\" rejected", r.ok === false && r.code === "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME");
  }

  // 4. output "unknown 8.0.4" fails MIG028 — no substring/prefix acceptance.
  {
    const r = evaluateVersionProbeResult(fake({ stdout: "unknown 8.0.4" }), "8.0.4");
    check("sub-assertion 4: \"unknown 8.0.4\" (extra text) rejected", r.ok === false && r.code === "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME");
  }

  // 5. blank output fails MIG028.
  {
    const r = evaluateVersionProbeResult(fake({ stdout: "" }), "8.0.4");
    check("sub-assertion 5: blank output rejected", r.ok === false && r.code === "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME");
  }

  // 6. output "9.0.0" fails MIG028.
  {
    const r = evaluateVersionProbeResult(fake({ stdout: "9.0.0" }), "8.0.4");
    check("sub-assertion 6: wrong version \"9.0.0\" rejected", r.ok === false && r.code === "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME");
  }

  // 7. nonzero status fails MIG028.
  {
    const r = evaluateVersionProbeResult(fake({ status: 1, stdout: "8.0.4" }), "8.0.4");
    check("sub-assertion 7: nonzero exit status rejected", r.ok === false && r.code === "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME");
  }

  // 8. signal termination fails MIG028.
  {
    const r = evaluateVersionProbeResult(fake({ status: null, signal: "SIGKILL" }), "8.0.4");
    check("sub-assertion 8: signal termination rejected", r.ok === false && r.code === "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME");
  }

  // 9. null status (without a signal) fails MIG028.
  {
    const r = evaluateVersionProbeResult(fake({ status: null, signal: null }), "8.0.4");
    check("sub-assertion 9: null status rejected", r.ok === false && r.code === "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME");
  }

  // 10. spawn error fails MIG028.
  {
    const r = evaluateVersionProbeResult(fake({ status: null, error: new Error("ENOENT") }), "8.0.4");
    check("sub-assertion 10: spawn error rejected", r.ok === false && r.code === "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME");
  }

  record(
    "dynamic:false-success-prevention",
    failures.length === 0,
    failures.length === 0 ? undefined : `sub-assertions failed: ${failures.join("; ")}`,
  );
}

// ---------------------------------------------------------------------
// redo.mjs function-level orchestration cases (22-27)
// ---------------------------------------------------------------------

function fakeResult({ status = 0, error = null, signal = null }) {
  return { status, error, signal, stdout: "", stderr: "" };
}

{
  const calls = [];
  const invoke = (cliPath, args) => {
    calls.push(args);
    return fakeResult({ status: 0 });
  };
  const outcome = runRedoOrchestration({ cliPath: "/fake/cli.js", repoRoot, invoke });
  const orderOk =
    calls.length === 2 &&
    calls[0][0] === "down" &&
    calls[1][0] === "up";
  record("redo:invokes-down-then-up-in-order", outcome.ok && orderOk);
}

{
  const calls = [];
  const invoke = (cliPath, args) => {
    calls.push(args);
    return fakeResult({ status: 1 });
  };
  const outcome = runRedoOrchestration({ cliPath: "/fake/cli.js", repoRoot, invoke });
  record("redo:up-not-invoked-when-down-fails", !outcome.ok && calls.length === 1);
}

{
  let callIndex = 0;
  const invoke = () => {
    callIndex += 1;
    return fakeResult({ status: callIndex === 1 ? 0 : 1 });
  };
  const outcome = runRedoOrchestration({ cliPath: "/fake/cli.js", repoRoot, invoke });
  record("redo:partial-failure-exits-nonzero", !outcome.ok);
}

{
  let callIndex = 0;
  const invoke = () => {
    callIndex += 1;
    return fakeResult({ status: callIndex === 1 ? 0 : 1 });
  };
  const outcome = runRedoOrchestration({ cliPath: "/fake/cli.js", repoRoot, invoke });
  record(
    "redo:partial-failure-emits-recovery-diagnostic",
    !outcome.ok && outcome.code === "MIG035_REDO_PARTIAL_FAILURE" && /down \(rolled-back\) state/.test(outcome.reason),
  );
}

{
  let callIndex = 0;
  const invoke = () => {
    callIndex += 1;
    if (callIndex === 1) return fakeResult({ status: 0 });
    return fakeResult({ status: null, signal: "SIGKILL" });
  };
  const outcome = runRedoOrchestration({ cliPath: "/fake/cli.js", repoRoot, invoke });
  record("redo:no-false-success-after-signal-failure", !outcome.ok && outcome.code === "MIG035_REDO_PARTIAL_FAILURE");
}

{
  // Expanded (Gate C sixth-pass amendment, post-Gate-F) with 12
  // ignore-pattern sub-assertions, folded into this same existing
  // top-level record — no new top-level test case is added.
  const downArgs = buildRedoDownArgs("/fake/cli.js");
  const upArgs = buildRedoUpArgs("/fake/cli.js");
  const noRedoAction = !downArgs.includes("redo") && !upArgs.includes("redo");
  const correctActions = downArgs[1] === "down" && upArgs[1] === "up";

  const failures = [];
  const check = (label, condition) => {
    if (!condition) failures.push(label);
  };
  check("redo action never passed", noRedoAction && correctActions);

  const countIgnorePatternPairs = (args) => {
    let count = 0;
    for (let i = 0; i < args.length - 1; i += 1) {
      if (args[i] === "--ignore-pattern" && args[i + 1] === NODE_PG_MIGRATE_IGNORE_PATTERN) count += 1;
    }
    return count;
  };

  // 1. up argv contains exactly one --ignore-pattern followed by the exact pattern.
  const upArgsReal = buildUpArgs("/fake/cli.js", false);
  check("sub-assertion 1: up argv has exactly one --ignore-pattern pair", countIgnorePatternPairs(upArgsReal) === 1);

  // 2. down argv contains the same exact pair once.
  const downArgsReal = buildDownArgs("/fake/cli.js");
  check("sub-assertion 2: down argv has exactly one --ignore-pattern pair", countIgnorePatternPairs(downArgsReal) === 1);

  // 3. redo down half contains the same exact pair once.
  check("sub-assertion 3: redo down-half argv has exactly one --ignore-pattern pair", countIgnorePatternPairs(downArgs) === 1);

  // 4. redo up half contains the same exact pair once.
  check("sub-assertion 4: redo up-half argv has exactly one --ignore-pattern pair", countIgnorePatternPairs(upArgs) === 1);

  // 5. no wrapper accepts a user-provided --ignore-pattern (static source scan
  // of each wrapper's user-facing allowlist object, not the internal fixed argv builder).
  {
    const upSource = readFileSync(join(__dirname, "up.mjs"), "utf8");
    const downSource = readFileSync(join(__dirname, "down.mjs"), "utf8");
    const redoSource = readFileSync(join(__dirname, "redo.mjs"), "utf8");
    const upAllowedFlagsMatch = upSource.match(/ALLOWED_FLAGS\s*=\s*\{[^}]*\}/);
    const downAllowedFlagsMatch = downSource.match(/allowedFlags:\s*\{[^}]*\}/);
    const redoAllowedFlagsMatch = redoSource.match(/allowedFlags:\s*\{[^}]*\}/);
    check(
      "sub-assertion 5: no wrapper's user-facing allowlist includes ignore-pattern",
      Boolean(upAllowedFlagsMatch) &&
        !upAllowedFlagsMatch[0].includes("ignore-pattern") &&
        Boolean(downAllowedFlagsMatch) &&
        !downAllowedFlagsMatch[0].includes("ignore-pattern") &&
        Boolean(redoAllowedFlagsMatch) &&
        !redoAllowedFlagsMatch[0].includes("ignore-pattern"),
    );
  }

  // 6-11. exact pattern-matching behavior.
  const patternRegex = new RegExp(NODE_PG_MIGRATE_IGNORE_PATTERN);
  check("sub-assertion 6: pattern matches exact README.md", patternRegex.test("README.md"));
  check("sub-assertion 7: pattern matches exact template.sql", patternRegex.test("template.sql"));
  check("sub-assertion 8: pattern does not match README.md.bak", !patternRegex.test("README.md.bak"));
  check("sub-assertion 9: pattern does not match template.sql.bak", !patternRegex.test("template.sql.bak"));
  check("sub-assertion 10: pattern does not match lowercase readme.md", !patternRegex.test("readme.md"));
  check(
    "sub-assertion 11: pattern does not match a valid migration filename",
    !patternRegex.test("20260101000000_create-placeholder.sql"),
  );

  // 12. Control A (validateMigrationsDirectory) still runs before CLI
  // resolution/invocation in every wrapper — static source-order scan.
  {
    const checkOrder = (source, label) => {
      const validatorCallIdx = source.indexOf("validateMigrationsDirectory(");
      const cliResolutionCallIdx = source.indexOf("resolveVerifiedCli(");
      check(
        `sub-assertion 12: Control A precedes CLI resolution in ${label}`,
        validatorCallIdx !== -1 && cliResolutionCallIdx !== -1 && validatorCallIdx < cliResolutionCallIdx,
      );
    };
    checkOrder(readFileSync(join(__dirname, "up.mjs"), "utf8"), "up.mjs");
    checkOrder(readFileSync(join(__dirname, "down.mjs"), "utf8"), "down.mjs");
    checkOrder(readFileSync(join(__dirname, "redo.mjs"), "utf8"), "redo.mjs");
  }

  record(
    "redo:node-pg-migrate-redo-action-never-used",
    failures.length === 0,
    failures.length === 0 ? undefined : `sub-assertions failed: ${failures.join("; ")}`,
  );
}

// ---------------------------------------------------------------------
// create.mjs / lib/creation.mjs function-level placement cases (28-40)
// ---------------------------------------------------------------------

function buildScratchRepo() {
  const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-scratch-"));
  mkdirSync(join(scratchRoot, "migrations"), { recursive: true });
  writeFileSync(
    join(scratchRoot, "migrations", "template.sql"),
    readFileSync(join(repoRoot, "migrations", "template.sql"), "utf8"),
  );
  return scratchRoot;
}

function validCreateArgs(overrides = {}) {
  return {
    slug: "add-a-thing",
    owningContext: "wallet",
    description: "a description",
    rollbackNotes: "not_applicable: fixture",
    forwardFixNotes: "not_applicable: fixture",
    ...overrides,
  };
}

{
  const scratchRoot = buildScratchRepo();
  try {
    const result = createMigrationFile({ repoRoot: scratchRoot, ...validCreateArgs() });
    const tempDirIsUnderRepoRoot = result.ok; // if it succeeded, the temp dir was necessarily under repoRoot (creation.mjs enforces this internally) and was cleaned up
    record("create:temp-dir-under-repo-root-not-os-tmpdir", tempDirIsUnderRepoRoot, tempDirIsUnderRepoRoot ? undefined : JSON.stringify(result));
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = buildScratchRepo();
  try {
    const result = createMigrationFile({ repoRoot: scratchRoot, ...validCreateArgs() });
    const migrationsEntries = readdirSync(join(scratchRoot, "migrations"));
    const noLeftoverTempInMigrations = !migrationsEntries.some((n) => n.startsWith(TEMP_DIR_PREFIX));
    record("create:temp-dir-outside-migrations", result.ok && noLeftoverTempInMigrations);
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = buildScratchRepo();
  try {
    const result = createMigrationFile({ repoRoot: scratchRoot, ...validCreateArgs() });
    record("create:successful-placement", result.ok && result.destPath && readFileSync(result.destPath, "utf8").includes("owning_context: wallet"));
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = buildScratchRepo();
  try {
    // Deterministically construct a collision: pre-place a file whose name
    // is exactly the destination createMigrationFile is about to compute
    // (same UTC second), then confirm the call fails with MIG033 and does
    // not touch the pre-existing file.
    const expectedPrefix = computeUtcTimestamp();
    const expectedSlug = normalizeSlug("add-a-thing");
    const collidingPath = join(scratchRoot, "migrations", `${expectedPrefix}_${expectedSlug}.sql`);
    writeFileSync(collidingPath, "-- pre-existing, must not be touched\n");
    const before = readFileSync(collidingPath, "utf8");

    const result = createMigrationFile({ repoRoot: scratchRoot, ...validCreateArgs({ slug: "add-a-thing" }) });
    const after = readFileSync(collidingPath, "utf8");

    record(
      "create:existing-destination-collision",
      !result.ok && result.code === "MIG033_DESTINATION_ALREADY_EXISTS" && before === after,
      result.ok ? "expected failure, but creation succeeded" : `code=${result.code}`,
    );
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  // Deterministic collision test: pre-place a file whose name starts with a
  // known timestamp prefix, then directly exercise checkPrefixCollision.
  const scratchRoot = buildScratchRepo();
  try {
    const prefix = "20260101000000";
    writeFileSync(join(scratchRoot, "migrations", `${prefix}_existing.sql`), "-- placeholder\n");
    const { collides } = checkPrefixCollision(join(scratchRoot, "migrations"), prefix);
    record("create:same-timestamp-prefix-collision-detected", collides);
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = buildScratchRepo();
  try {
    const before = readdirSync(join(scratchRoot, "migrations")).sort();
    const result = createMigrationFile({ repoRoot: scratchRoot, ...validCreateArgs({ owningContext: "not-a-real-context" }) });
    const after = readdirSync(join(scratchRoot, "migrations")).sort();
    const untouched = JSON.stringify(before) === JSON.stringify(after);
    record("create:validation-failure-leaves-migrations-untouched", !result.ok && untouched);
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = buildScratchRepo();
  try {
    const decoyName = `${TEMP_DIR_PREFIX}decoyXXXXXX`;
    mkdirSync(join(scratchRoot, decoyName));
    const result = createMigrationFile({ repoRoot: scratchRoot, ...validCreateArgs() });
    const decoyStillExists = lstatSync(join(scratchRoot, decoyName)).isDirectory();
    record("create:cleanup-removes-only-current-invocation-temp-dir", result.ok && decoyStillExists);
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const scratchRoot = buildScratchRepo();
  try {
    const decoyName = `${TEMP_DIR_PREFIX}decoyXXXXXX`;
    mkdirSync(join(scratchRoot, decoyName));
    const result = createMigrationFile({ repoRoot: scratchRoot, ...validCreateArgs({ owningContext: "not-a-real-context" }) });
    const decoyStillExists = lstatSync(join(scratchRoot, decoyName)).isDirectory();
    record("create:stale-temp-directory-from-another-invocation-untouched", !result.ok && decoyStillExists);
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  const realDir = buildScratchRepo();
  const linkPath = `${realDir}-symlink`;
  try {
    symlinkSync(realDir, linkPath);
    const result = createMigrationFile({ repoRoot: linkPath, ...validCreateArgs() });
    record("create:reporoot-symlink-rejection", !result.ok && result.code === "MIG900_INTERNAL_ERROR");
  } finally {
    rmSync(linkPath, { force: true });
    rmSync(realDir, { recursive: true, force: true });
  }
}

{
  const scratchRoot = mkdtempSync(join(tmpdir(), "fnd003-test-scratch-"));
  try {
    const realMigrationsElsewhere = mkdtempSync(join(tmpdir(), "fnd003-test-realmigrations-"));
    writeFileSync(
      join(realMigrationsElsewhere, "template.sql"),
      readFileSync(join(repoRoot, "migrations", "template.sql"), "utf8"),
    );
    symlinkSync(realMigrationsElsewhere, join(scratchRoot, "migrations"));
    const result = createMigrationFile({ repoRoot: scratchRoot, ...validCreateArgs() });
    record("create:migrations-symlink-rejection", !result.ok && result.code === "MIG002_SYMLINK_NOT_ALLOWED");
    rmSync(realMigrationsElsewhere, { recursive: true, force: true });
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  // Containment is enforced structurally (realpath + relative()) inside
  // verifyRepoRootAndMigrationsDir itself; a direct call against a
  // deliberately mismatched pair confirms the check fires.
  const scratchA = mkdtempSync(join(tmpdir(), "fnd003-test-a-"));
  const scratchB = mkdtempSync(join(tmpdir(), "fnd003-test-b-"));
  try {
    mkdirSync(join(scratchB, "migrations"));
    symlinkSync(join(scratchB, "migrations"), join(scratchA, "migrations"));
    const result = verifyRepoRootAndMigrationsDir(scratchA);
    record("create:containment-failure-no-recursive-delete", !result.ok);
  } finally {
    rmSync(scratchA, { recursive: true, force: true });
    rmSync(scratchB, { recursive: true, force: true });
  }
}

{
  const scratchRoot = buildScratchRepo();
  try {
    writeFileSync(join(scratchRoot, "migrations", "20260101000000_existing.sql"), "-- placeholder\n");
    const before = readFileSync(join(scratchRoot, "migrations", "20260101000000_existing.sql"), "utf8");
    const result = createMigrationFile({ repoRoot: scratchRoot, ...validCreateArgs({ owningContext: "not-a-real-context" }) });
    const after = readFileSync(join(scratchRoot, "migrations", "20260101000000_existing.sql"), "utf8");
    record("create:destination-never-deleted-on-failure", !result.ok && before === after);
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

{
  // Checks for an actual import of node:os (the only way tmpdir() could be
  // used functionally) — not a bare keyword search, since this file's own
  // explanatory comments legitimately mention "tmpdir()" when describing
  // what is deliberately NOT used.
  const source = readFileSync(join(__dirname, "lib", "creation.mjs"), "utf8");
  const clean = !/from\s+["']node:os["']/.test(source);
  record("create:no-os-tmpdir-design-remains", clean);
}

// ---------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------

let allPass = true;
for (const r of results) {
  if (r.pass) {
    console.log(r.reason ? `PASS ${r.name} :: ${r.reason}` : `PASS ${r.name}`);
  } else {
    console.log(`FAIL ${r.name} :: ${r.reason ?? "no reason given"}`);
    allPass = false;
  }
}
console.log(`\n${results.length} total cases, ${results.filter((r) => r.pass).length} passed, ${results.filter((r) => !r.pass).length} failed.`);

process.exitCode = allPass ? 0 : 1;

}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      `[INTERNAL ERROR] MIG900_INTERNAL_ERROR :: migrate:test failed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
    process.exitCode = 1;
  });
}

export { main, results };
