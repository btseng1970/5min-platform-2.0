import { Inject, Injectable } from "@nestjs/common";
import { CanonicalApiError } from "errors";
import type { FlagProvider } from "@5min/shared-flags";
import { DEMO_MEMBER_ID } from "test-fixtures";
import { FLAG_PROVIDER } from "../flags/flags.module";

/**
 * The only place a controller may obtain the Prototype's deterministic demo
 * member identity — never from caller-supplied request input. Internal
 * Prototype use only: gated by proto_demo_member (backend-authoritative,
 * production default off), no production PII, no member-creation API.
 */
@Injectable()
export class DemoMemberContextProvider {
  constructor(@Inject(FLAG_PROVIDER) private readonly flags: FlagProvider) {}

  resolveMemberId(): string {
    if (!this.flags.isEnabled("proto_demo_member")) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", "The demo member context is not enabled.");
    }
    return DEMO_MEMBER_ID;
  }
}
