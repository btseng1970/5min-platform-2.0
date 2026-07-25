// CLI resolution and identity verification for node-pg-migrate, adapted from
// tests/architecture/run-architecture-tests.mjs's resolveDependencyCruiserCli
// / verifyCliVersionIdentity pair (FND-002). Never invokes npm exec, npx, or
// a node_modules/.bin shim; always process.execPath + shell: false.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import {
  NODE_PG_MIGRATE_PACKAGE_NAME,
  NODE_PG_MIGRATE_VERSION,
  NODE_PG_MIGRATE_BIN_KEY,
  NODE_PG_MIGRATE_BIN_TARGET,
} from "./constants.mjs";

export function resolveNodePgMigrateCli(repoRoot) {
  const packageDir = join(repoRoot, "node_modules", NODE_PG_MIGRATE_PACKAGE_NAME);
  const pkgJsonPath = join(packageDir, "package.json");

  if (!existsSync(pkgJsonPath)) {
    return {
      ok: false,
      code: "MIG021_CLI_NOT_FOUND",
      reason: `${relative(repoRoot, pkgJsonPath)} not found`,
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  } catch (err) {
    return {
      ok: false,
      code: "MIG021_CLI_NOT_FOUND",
      reason: `failed to parse ${relative(repoRoot, pkgJsonPath)} as JSON: ${err.message}`,
    };
  }

  if (manifest.name !== NODE_PG_MIGRATE_PACKAGE_NAME) {
    return {
      ok: false,
      code: "MIG022_CLI_WRONG_PACKAGE_NAME",
      reason: `expected package name "${NODE_PG_MIGRATE_PACKAGE_NAME}", found "${manifest.name}"`,
    };
  }

  if (manifest.version !== NODE_PG_MIGRATE_VERSION) {
    return {
      ok: false,
      code: "MIG023_CLI_WRONG_VERSION",
      reason: `expected version ${NODE_PG_MIGRATE_VERSION}, found "${manifest.version}"`,
    };
  }

  if (
    !manifest.bin ||
    typeof manifest.bin !== "object" ||
    !manifest.bin[NODE_PG_MIGRATE_BIN_KEY]
  ) {
    return {
      ok: false,
      code: "MIG024_CLI_WRONG_BIN_KEY",
      reason: `bin["${NODE_PG_MIGRATE_BIN_KEY}"] entry is missing`,
    };
  }

  const binRelative = manifest.bin[NODE_PG_MIGRATE_BIN_KEY];
  if (binRelative !== NODE_PG_MIGRATE_BIN_TARGET) {
    return {
      ok: false,
      code: "MIG025_CLI_WRONG_BIN_TARGET",
      reason: `expected bin["${NODE_PG_MIGRATE_BIN_KEY}"] to be exactly "${NODE_PG_MIGRATE_BIN_TARGET}", found "${binRelative}"`,
    };
  }

  const cliPathUnresolved = join(packageDir, binRelative);
  if (!existsSync(cliPathUnresolved)) {
    return {
      ok: false,
      code: "MIG025_CLI_WRONG_BIN_TARGET",
      reason: `resolved CLI path does not exist: ${relative(repoRoot, cliPathUnresolved)}`,
    };
  }

  let realPackageDir;
  let realCliPath;
  try {
    realPackageDir = realpathSync(packageDir);
    realCliPath = realpathSync(cliPathUnresolved);
  } catch (err) {
    return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: `realpath resolution failed: ${err.message}` };
  }

  const relativeFromPackage = relative(realPackageDir, realCliPath);
  if (relativeFromPackage.startsWith("..") || isAbsolute(relativeFromPackage)) {
    return {
      ok: false,
      code: "MIG026_CLI_PATH_ESCAPE",
      reason: `resolved CLI path escapes the node-pg-migrate package directory: ${realCliPath}`,
    };
  }

  let cliStat;
  try {
    cliStat = statSync(realCliPath);
  } catch (err) {
    return { ok: false, code: "MIG900_INTERNAL_ERROR", reason: `failed to stat resolved CLI path: ${err.message}` };
  }
  if (!cliStat.isFile()) {
    return {
      ok: false,
      code: "MIG027_CLI_NOT_REGULAR_FILE",
      reason: `resolved CLI path is not a regular file: ${realCliPath}`,
    };
  }

  return { ok: true, cliPath: realCliPath, packageVersion: manifest.version };
}

// Pure interpretation of a --version spawnSync-shaped result. Exported and
// independently testable via injected fake results — never spawns a process
// itself. `packageVersion` is the structurally-verified version from
// resolveNodePgMigrateCli (authoritative source: package.json), never the
// runtime probe's own output.
//
// Narrow, version-pinned compatibility exception (Gate C fifth-pass
// amendment): node-pg-migrate@8.0.4's real CLI deterministically prints the
// literal string "unknown" for --version, because its bin script is an ES
// module and yargs' own --version auto-detection relies on a CommonJS
// require.main mechanism that does not resolve for an ESM entrypoint. The
// exact, case-sensitive literal "unknown" is accepted ONLY when
// packageVersion is already exactly "8.0.4" (i.e. only ever reachable after
// full structural success against that exact version) and the process
// exited 0 with no signal/spawn error. This is never described as runtime
// confirmation of the version — runtimeVersionConfirmed is explicitly false
// in this case. It never matches any other output: not "Unknown", not
// "unknown 8.0.4", not blank, not any other version string, not a
// substring/prefix match.
export function evaluateVersionProbeResult(spawnResult, packageVersion) {
  if (
    spawnResult.error ||
    spawnResult.signal !== null ||
    spawnResult.status === null ||
    spawnResult.status !== 0
  ) {
    return {
      ok: false,
      code: "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME",
      reason:
        `--version invocation failed (error=${spawnResult.error ? spawnResult.error.message : "none"}, ` +
        `signal=${spawnResult.signal}, status=${spawnResult.status})`,
    };
  }

  const output = `${spawnResult.stdout ?? ""}${spawnResult.stderr ?? ""}`;
  const normalizedVersion = output.trim().replace(/^v/, "");

  if (normalizedVersion === packageVersion) {
    return { ok: true, runtimeVersionOutput: normalizedVersion, runtimeVersionConfirmed: true };
  }

  if (normalizedVersion === "unknown" && packageVersion === NODE_PG_MIGRATE_VERSION) {
    return { ok: true, runtimeVersionOutput: "unknown", runtimeVersionConfirmed: false };
  }

  return {
    ok: false,
    code: "MIG028_CLI_VERSION_MISMATCH_AT_RUNTIME",
    reason: `--version output "${output.trim()}" (normalized "${normalizedVersion}") does not exactly equal ${packageVersion} and is not the accepted "unknown" compatibility exception`,
  };
}

export function verifyCliVersionIdentity(cliPath, repoRoot, packageVersion = NODE_PG_MIGRATE_VERSION) {
  const result = spawnSync(process.execPath, [cliPath, "--version"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });

  return evaluateVersionProbeResult(result, packageVersion);
}

// Single required entrypoint for every migrate:* wrapper.
export function resolveVerifiedCli(repoRoot) {
  const resolution = resolveNodePgMigrateCli(repoRoot);
  if (!resolution.ok) return resolution;

  const probe = verifyCliVersionIdentity(resolution.cliPath, repoRoot, resolution.packageVersion);
  if (!probe.ok) return probe;

  return {
    ok: true,
    cliPath: resolution.cliPath,
    packageVersion: resolution.packageVersion,
    authoritativeVersionSource: "package.json",
    runtimeVersionOutput: probe.runtimeVersionOutput,
    runtimeVersionConfirmed: probe.runtimeVersionConfirmed,
  };
}

// Invokes the resolved CLI. Never npm exec/npx/.bin shim, never shell: true.
export function invokeCli(cliPath, args, repoRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    stdio: "inherit",
  });
}

export function isCommandExecutionFailure(result) {
  return Boolean(result.error) || result.signal !== null || result.status === null;
}
