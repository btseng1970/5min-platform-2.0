// Typed CORS policy resolver. Not domain code — apps/api's own bootstrap
// layer (main.ts) is already the established boundary permitted to read
// process.env directly (same rationale as FlagsModule's EnvFlagProvider
// factory); domain/application code never depends on this file.
//
// No wildcard, ever. Default (the env var unset) is fully restrictive —
// safe for production and any zero-configuration runtime, since a runtime
// that never explicitly opts in to a known local/demo origin gets no CORS
// allowance at all. Only an explicit, comma-separated
// PROTOTYPE_DEMO_ALLOWED_ORIGINS opts a runtime into allowing specific
// known origins — e.g. apps/web's local dev server for the browser-based
// demo journey. This is deliberately narrower than a general CORS
// framework: an explicit allowlist or nothing, never a reflected/wildcard
// origin.

export interface CorsPolicy {
  origin: string[] | false;
}

const ALLOWED_ORIGINS_ENV_VAR = "PROTOTYPE_DEMO_ALLOWED_ORIGINS";

export function resolveCorsPolicy(env: Readonly<Record<string, string | undefined>>): CorsPolicy {
  const raw = env[ALLOWED_ORIGINS_ENV_VAR];
  if (!raw) {
    return { origin: false };
  }

  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    return { origin: false };
  }

  return { origin: origins };
}
