import { Inject, Injectable } from "@nestjs/common";
import type { FlagProvider } from "@5min/shared-flags";
import { FLAG_PROVIDER } from "../flags/flags.module";

/**
 * The sole gate for the internal admin correlation trace. Requires BOTH
 * proto_internal_demo_runtime (this host is a valid internal-demo runtime
 * at all) AND proto_admin_trace (this specific feature is on within that
 * runtime) — so a production runtime can never expose the admin trace
 * route merely because someone flips proto_admin_trace on; a second,
 * independent opt-in is required. Purely a deterministic server-side
 * runtime check — no caller-supplied role, header, or request field is
 * ever consulted, and this is not a substitute for real RBAC (out of
 * Prototype scope).
 */
@Injectable()
export class InternalDemoAdminContext {
  constructor(@Inject(FLAG_PROVIDER) private readonly flags: FlagProvider) {}

  isAvailable(): boolean {
    return this.flags.isEnabled("proto_internal_demo_runtime") && this.flags.isEnabled("proto_admin_trace");
  }
}
