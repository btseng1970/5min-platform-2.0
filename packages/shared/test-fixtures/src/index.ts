// Deterministic fixture identifiers shared across domain packages and the
// BFF orchestration layer (apps/api). Living here — not inside any single
// packages/domain/* package — is what lets multiple domain services agree on
// the same well-known demo IDs without a forbidden domain-to-domain import.
// No production PII of any kind is represented by any of these constants.

export const DEMO_CAMPAIGN_ID = "demo_campaign_tw_001";
export const DEMO_MEMBER_ID = "demo_member_tw_001";
export const DEMO_MEMBER_DISPLAY_NAME = "Demo Member (TW)";
