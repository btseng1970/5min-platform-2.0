// Typed environment/config feature flags, per docs/roadmaps/prototype-acceleration.md §5.
// Rules: backend enforcement is authoritative; production defaults off; tests
// may inject overrides; domain core never reads environment variables
// directly — only this module's env-reading adapter does. Domain/application
// code depends only on the FlagProvider interface below.

export type PrototypeFlagName =
  | "proto_campaign_shell"
  | "proto_demo_member"
  | "proto_qr_scan"
  | "proto_draw"
  | "proto_wallet_grant"
  | "proto_collection"
  | "proto_member_center"
  | "proto_admin_trace"
  // Deliberately separate from every per-feature flag above: this asserts
  // "this host is a valid internal-demo runtime at all," not "this one
  // feature is on." The admin correlation trace (apps/api's AdminController)
  // requires both this flag AND proto_admin_trace, so a production runtime
  // can never expose that route merely by someone flipping proto_admin_trace
  // on — a second, independent opt-in is required.
  | "proto_internal_demo_runtime";

export const ALL_PROTOTYPE_FLAGS: readonly PrototypeFlagName[] = [
  "proto_campaign_shell",
  "proto_demo_member",
  "proto_qr_scan",
  "proto_draw",
  "proto_wallet_grant",
  "proto_collection",
  "proto_member_center",
  "proto_admin_trace",
  "proto_internal_demo_runtime",
];

export interface FlagProvider {
  isEnabled(flag: PrototypeFlagName): boolean;
}

function envVarNameFor(flag: PrototypeFlagName): string {
  return `${flag.toUpperCase()}_ENABLED`;
}

/**
 * The only component in this repository permitted to read process.env for
 * Prototype flags. Every flag defaults to disabled; a flag is enabled only
 * when its exact environment variable is literally the string "true".
 */
export class EnvFlagProvider implements FlagProvider {
  private readonly env: Readonly<Record<string, string | undefined>>;

  constructor(env: Readonly<Record<string, string | undefined>>) {
    this.env = env;
  }

  isEnabled(flag: PrototypeFlagName): boolean {
    return this.env[envVarNameFor(flag)] === "true";
  }
}

/** Test-only override provider — never used in production wiring. */
export class StaticFlagProvider implements FlagProvider {
  private readonly overrides: Partial<Record<PrototypeFlagName, boolean>>;

  constructor(overrides: Partial<Record<PrototypeFlagName, boolean>> = {}) {
    this.overrides = overrides;
  }

  isEnabled(flag: PrototypeFlagName): boolean {
    return this.overrides[flag] ?? false;
  }

  withOverride(flag: PrototypeFlagName, value: boolean): StaticFlagProvider {
    return new StaticFlagProvider({ ...this.overrides, [flag]: value });
  }
}
