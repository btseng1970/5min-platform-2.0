export default {
  forbidden: [
    {
      name: "no-cross-domain-import",
      comment:
        "Domain packages must not import from other domain packages — runtime or " +
        "type-only, including through another domain's public entrypoint file.",
      severity: "error",
      from: { path: "(?:^|/)packages/domain/([^/]+)/src/" },
      to: {
        path: "(?:^|/)packages/domain/",
        pathNot: "(?:^|/)packages/domain/$1/",
      },
    },
    {
      name: "no-domain-self-import",
      comment:
        "Defense-in-depth only: domain packages must not import themselves via " +
        "their own declared npm package name. Its aliased-workspace matching " +
        "requires a real installed workspace and is not fixture-tested in " +
        "FND-002 — primary enforcement is the TypeScript Compiler API " +
        "specifier scanner.",
      severity: "error",
      from: { path: "(?:^|/)packages/domain/([^/]+)/src/" },
      to: {
        path: "(?:^|/)packages/domain/$1/",
        dependencyTypes: ["aliased-workspace"],
      },
    },
    {
      name: "no-deep-import-into-shared",
      comment:
        "Domain packages must import shared packages via their declared entrypoint " +
        "(src/index.ts) only, not by reaching into another file under " +
        "packages/shared/*/src/**.",
      severity: "error",
      from: { path: "(?:^|/)packages/domain/" },
      to: {
        path: "(?:^|/)packages/shared/[^/]+/src/(?!index\\.ts$).+",
      },
    },
    {
      name: "no-app-to-app-import",
      comment:
        "Each apps/* deployable must not import source files from a different " +
        "apps/* deployable.",
      severity: "error",
      from: { path: "(?:^|/)apps/([^/]+)/" },
      to: {
        path: "(?:^|/)apps/",
        pathNot: "(?:^|/)apps/$1/",
      },
    },
  ],
  options: {
    tsConfig: {
      fileName: "tsconfig.base.json",
    },
    tsPreCompilationDeps: true,
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(dist|coverage|\\.next)(/|$)",
    },
  },
};
