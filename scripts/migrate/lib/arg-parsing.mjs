// Shared strict argument-allowlist parser used by every scripts/migrate/**
// wrapper. Rejects unknown flags, duplicate flags, missing values, extra
// positionals, and empty values. Never forwards a caller-supplied argument to
// node-pg-migrate without going through this allowlist first.

export function parseStrictArgs(argv, { allowedFlags = {}, maxPositionals = 0, requiredFlags = [] } = {}) {
  const positionals = [];
  const flags = {};
  const seen = new Set();

  for (const raw of argv) {
    if (!raw.startsWith("--")) {
      positionals.push(raw);
      continue;
    }

    const withoutDashes = raw.slice(2);
    const eqIndex = withoutDashes.indexOf("=");
    const flagName = eqIndex === -1 ? withoutDashes : withoutDashes.slice(0, eqIndex);
    const spec = allowedFlags[flagName];

    if (!spec) {
      return {
        ok: false,
        code: "MIG030_FORBIDDEN_ARGUMENT",
        reason: `unknown flag "--${flagName}"`,
      };
    }
    if (seen.has(flagName)) {
      return {
        ok: false,
        code: "MIG030_FORBIDDEN_ARGUMENT",
        reason: `duplicate flag "--${flagName}"`,
      };
    }
    seen.add(flagName);

    if (spec.takesValue) {
      if (eqIndex === -1) {
        return {
          ok: false,
          code: "MIG030_FORBIDDEN_ARGUMENT",
          reason: `flag "--${flagName}" requires a value (use --${flagName}=value)`,
        };
      }
      const value = withoutDashes.slice(eqIndex + 1);
      if (value.trim() === "") {
        return {
          ok: false,
          code: "MIG030_FORBIDDEN_ARGUMENT",
          reason: `flag "--${flagName}" has an empty value`,
        };
      }
      flags[flagName] = value;
    } else {
      if (eqIndex !== -1) {
        return {
          ok: false,
          code: "MIG030_FORBIDDEN_ARGUMENT",
          reason: `flag "--${flagName}" does not accept a value`,
        };
      }
      flags[flagName] = true;
    }
  }

  if (positionals.length > maxPositionals) {
    return {
      ok: false,
      code: "MIG030_FORBIDDEN_ARGUMENT",
      reason: `unexpected extra positional argument(s): ${positionals.slice(maxPositionals).join(", ")}`,
    };
  }

  for (const required of requiredFlags) {
    if (!seen.has(required)) {
      return {
        ok: false,
        code: "MIG030_FORBIDDEN_ARGUMENT",
        reason: `missing required flag "--${required}"`,
      };
    }
  }

  return { ok: true, positionals, flags };
}
