import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");

if (!statSync(repoRoot).isDirectory()) {
  throw new Error(`resolved repoRoot is not a directory: ${repoRoot}`);
}

const DEPENDENCY_CRUISER_VERSION = "18.1.0";

function toPosixPath(p) {
  return p.replace(/\\/g, "/");
}

function resolveDependencyCruiserCli() {
  const packageDir = join(repoRoot, "node_modules", "dependency-cruiser");
  const pkgJsonPath = join(packageDir, "package.json");

  if (!existsSync(pkgJsonPath)) {
    return {
      ok: false,
      reason: `${relative(repoRoot, pkgJsonPath)} not found`,
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  } catch (err) {
    return {
      ok: false,
      reason: `failed to parse ${relative(repoRoot, pkgJsonPath)} as JSON: ${err.message}`,
    };
  }

  if (manifest.name !== "dependency-cruiser") {
    return {
      ok: false,
      reason: `expected package name "dependency-cruiser", found "${manifest.name}"`,
    };
  }

  if (manifest.version !== DEPENDENCY_CRUISER_VERSION) {
    return {
      ok: false,
      reason: `expected version ${DEPENDENCY_CRUISER_VERSION}, found "${manifest.version}"`,
    };
  }

  if (!manifest.bin) {
    return { ok: false, reason: `package.json has no "bin" field` };
  }

  let binRelative;
  if (typeof manifest.bin === "object" && manifest.bin !== null) {
    binRelative = manifest.bin.depcruise;
    if (!binRelative) {
      return { ok: false, reason: `bin.depcruise entry is missing` };
    }
  } else if (typeof manifest.bin === "string") {
    binRelative = manifest.bin;
  } else {
    return {
      ok: false,
      reason: `unsupported "bin" field type: ${typeof manifest.bin}`,
    };
  }

  const cliPathUnresolved = join(packageDir, binRelative);

  if (!existsSync(cliPathUnresolved)) {
    return {
      ok: false,
      reason: `resolved CLI path does not exist: ${relative(repoRoot, cliPathUnresolved)}`,
    };
  }

  let realPackageDir;
  let realCliPath;
  try {
    realPackageDir = realpathSync(packageDir);
    realCliPath = realpathSync(cliPathUnresolved);
  } catch (err) {
    return { ok: false, reason: `realpath resolution failed: ${err.message}` };
  }

  const relativeFromPackage = relative(realPackageDir, realCliPath);
  if (relativeFromPackage.startsWith("..") || isAbsolute(relativeFromPackage)) {
    return {
      ok: false,
      reason: `resolved CLI path escapes the dependency-cruiser package directory: ${realCliPath}`,
    };
  }

  let cliStat;
  try {
    cliStat = statSync(realCliPath);
  } catch (err) {
    return {
      ok: false,
      reason: `failed to stat resolved CLI path: ${err.message}`,
    };
  }
  if (!cliStat.isFile()) {
    return {
      ok: false,
      reason: `resolved CLI path is not a regular file: ${realCliPath}`,
    };
  }

  return { ok: true, cliPath: realCliPath };
}

function verifyCliVersionIdentity(cliPath) {
  const result = spawnSync(process.execPath, [cliPath, "--version"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });

  if (result.error || result.signal !== null || result.status === null || result.status !== 0) {
    return {
      ok: false,
      reason:
        `--version invocation failed (error=${result.error ? result.error.message : "none"}, ` +
        `signal=${result.signal}, status=${result.status})`,
    };
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const normalizedVersion = output.trim().replace(/^v/, "");

  if (normalizedVersion !== DEPENDENCY_CRUISER_VERSION) {
    return {
      ok: false,
      reason: `--version output "${output.trim()}" (normalized "${normalizedVersion}") does not exactly equal ${DEPENDENCY_CRUISER_VERSION}`,
    };
  }

  return { ok: true };
}

function runDepcruise(cliPath, targets) {
  return spawnSync(
    process.execPath,
    [cliPath, "--config", ".dependency-cruiser.mjs", "--output-type", "err", ...targets],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: false,
    },
  );
}

function isCommandExecutionFailure(result) {
  return Boolean(result.error) || result.signal !== null || result.status === null;
}

const DEPCRUISE_CASES = [
  {
    name: "real-repo",
    targets: ["packages/domain", "packages/shared", "apps"],
    expect: "pass",
  },
  {
    name: "allowed/domain-to-shared-entrypoint",
    targets: [
      "tests/architecture/fixtures/allowed/domain-to-shared-entrypoint/packages/domain",
      "tests/architecture/fixtures/allowed/domain-to-shared-entrypoint/packages/shared",
    ],
    expect: "pass",
  },
  {
    name: "allowed/relative-internal-import",
    targets: [
      "tests/architecture/fixtures/allowed/relative-internal-import/packages/domain",
    ],
    expect: "pass",
  },
  {
    name: "forbidden/domain-to-domain-runtime",
    targets: [
      "tests/architecture/fixtures/forbidden/domain-to-domain-runtime/packages/domain",
    ],
    expect: "fail",
    ruleId: "no-cross-domain-import",
  },
  {
    name: "forbidden/domain-to-domain-type-only",
    targets: [
      "tests/architecture/fixtures/forbidden/domain-to-domain-type-only/packages/domain",
    ],
    expect: "fail",
    ruleId: "no-cross-domain-import",
  },
  {
    name: "forbidden/deep-import-into-shared",
    targets: [
      "tests/architecture/fixtures/forbidden/deep-import-into-shared/packages/domain",
      "tests/architecture/fixtures/forbidden/deep-import-into-shared/packages/shared",
    ],
    expect: "fail",
    ruleId: "no-deep-import-into-shared",
  },
  {
    name: "forbidden/app-to-app",
    targets: ["tests/architecture/fixtures/forbidden/app-to-app/apps"],
    expect: "fail",
    ruleId: "no-app-to-app-import",
  },
];

function evaluateDepcruiseCase(caseDef, cliPath) {
  const result = runDepcruise(cliPath, caseDef.targets);

  if (isCommandExecutionFailure(result)) {
    return {
      name: caseDef.name,
      pass: false,
      reason:
        `command-execution failure (error=${result.error ? result.error.message : "none"}, ` +
        `signal=${result.signal}, status=${result.status})`,
    };
  }

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (caseDef.expect === "pass") {
    if (result.status === 0) {
      return { name: caseDef.name, pass: true };
    }
    return {
      name: caseDef.name,
      pass: false,
      reason: `expected exit code 0, got ${result.status}`,
    };
  }

  // caseDef.expect === "fail"
  if (result.status === 0) {
    return {
      name: caseDef.name,
      pass: false,
      reason: "unexpectedly succeeded (exit code 0)",
    };
  }
  if (output.includes(caseDef.ruleId)) {
    return { name: caseDef.name, pass: true };
  }
  return {
    name: caseDef.name,
    pass: false,
    reason: `failed for the wrong reason (expected rule ID "${caseDef.ruleId}" not found in output)`,
  };
}

function listTsFilesRecursive(dir) {
  const results = [];
  if (!existsSync(dir)) {
    return results;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTsFilesRecursive(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      results.push(full);
    }
  }
  return results.sort();
}

function extractSpecifierNode(node) {
  if (
    ts.isImportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier;
  }
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier;
  }
  if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference) &&
    ts.isStringLiteral(node.moduleReference.expression)
  ) {
    return node.moduleReference.expression;
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0];
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "require" &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0];
  }
  return null;
}

function scanPackageForSelfImport(packageDir) {
  const ownName = JSON.parse(
    readFileSync(join(packageDir, "package.json"), "utf8"),
  ).name;
  const files = listTsFilesRecursive(join(packageDir, "src"));
  const diagnostics = [];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.ES2022,
      true,
    );

    function visit(node) {
      const specifierNode = extractSpecifierNode(node);
      if (specifierNode && specifierNode.text === ownName) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          specifierNode.getStart(sourceFile),
        );
        diagnostics.push({
          ruleId: "no-domain-self-import",
          file: toPosixPath(relative(repoRoot, file)),
          line: line + 1,
          column: character + 1,
          specifier: specifierNode.text,
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }

  diagnostics.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  );
  return diagnostics;
}

function findRealDomainPackageDirs() {
  const domainRoot = join(repoRoot, "packages", "domain");
  return readdirSync(domainRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((name) => join(domainRoot, name));
}

async function main() {
  const resolution = resolveDependencyCruiserCli();
  if (!resolution.ok) {
    console.log(
      `[INTERNAL ERROR] local dependency-cruiser@${DEPENDENCY_CRUISER_VERSION} is required; run npm ci before architecture tests (${resolution.reason})`,
    );
    process.exitCode = 1;
    return;
  }

  const identity = verifyCliVersionIdentity(resolution.cliPath);
  if (!identity.ok) {
    console.log(
      `[INTERNAL ERROR] local dependency-cruiser@${DEPENDENCY_CRUISER_VERSION} is required; run npm ci before architecture tests (${identity.reason})`,
    );
    process.exitCode = 1;
    return;
  }

  const results = [];

  for (const caseDef of DEPCRUISE_CASES) {
    results.push(evaluateDepcruiseCase(caseDef, resolution.cliPath));
  }

  const realRepoDiagnostics = [];
  for (const pkgDir of findRealDomainPackageDirs()) {
    realRepoDiagnostics.push(...scanPackageForSelfImport(pkgDir));
  }
  const realRepoPass = realRepoDiagnostics.length === 0;
  results.push({
    name: "self-import/real-repo",
    pass: realRepoPass,
    reason: realRepoPass
      ? undefined
      : `expected 0 findings, got ${realRepoDiagnostics.length}: ${JSON.stringify(realRepoDiagnostics)}`,
  });

  const fixturePackageDir = join(
    repoRoot,
    "tests",
    "architecture",
    "fixtures",
    "forbidden",
    "self-import-via-own-name",
    "packages",
    "domain",
    "wallet",
  );
  const fixtureDiagnostics = scanPackageForSelfImport(fixturePackageDir);
  const fixturePass =
    fixtureDiagnostics.length === 1 &&
    fixtureDiagnostics[0].ruleId === "no-domain-self-import" &&
    fixtureDiagnostics[0].file.endsWith("src/other.ts") &&
    fixtureDiagnostics[0].specifier === "@5min/domain-wallet";
  results.push({
    name: "self-import/fixture",
    pass: fixturePass,
    reason: fixturePass
      ? undefined
      : `unexpected diagnostics: ${JSON.stringify(fixtureDiagnostics)}`,
  });

  let allPass = true;
  for (const r of results) {
    if (r.pass) {
      console.log(`PASS ${r.name}`);
    } else {
      console.log(`FAIL ${r.name} :: ${r.reason}`);
      allPass = false;
    }
  }

  process.exitCode = allPass ? 0 : 1;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(
      `[INTERNAL ERROR] architecture runner failed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
    process.exitCode = 1;
  });
}

export {
  main,
  resolveDependencyCruiserCli,
  verifyCliVersionIdentity,
  evaluateDepcruiseCase,
  scanPackageForSelfImport,
  DEPCRUISE_CASES,
};
