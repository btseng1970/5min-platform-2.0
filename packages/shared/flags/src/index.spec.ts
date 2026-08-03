import { EnvFlagProvider, StaticFlagProvider } from "./index";

describe("EnvFlagProvider", () => {
  it("defaults every flag to disabled when the environment variable is absent", () => {
    const provider = new EnvFlagProvider({});
    expect(provider.isEnabled("proto_campaign_shell")).toBe(false);
    expect(provider.isEnabled("proto_draw")).toBe(false);
  });

  it("enables a flag only when its exact env var is the literal string 'true'", () => {
    const provider = new EnvFlagProvider({
      PROTO_CAMPAIGN_SHELL_ENABLED: "true",
      PROTO_DRAW_ENABLED: "1",
      PROTO_WALLET_GRANT_ENABLED: "TRUE",
    });
    expect(provider.isEnabled("proto_campaign_shell")).toBe(true);
    expect(provider.isEnabled("proto_draw")).toBe(false);
    expect(provider.isEnabled("proto_wallet_grant")).toBe(false);
  });

  it("production defaults off — an empty environment enables nothing", () => {
    const provider = new EnvFlagProvider(process.env);
    for (const flag of [
      "proto_campaign_shell",
      "proto_demo_member",
      "proto_qr_scan",
      "proto_draw",
      "proto_wallet_grant",
      "proto_collection",
      "proto_member_center",
      "proto_admin_trace",
    ] as const) {
      expect(provider.isEnabled(flag)).toBe(false);
    }
  });
});

describe("StaticFlagProvider", () => {
  it("defaults every flag to disabled with no overrides", () => {
    const provider = new StaticFlagProvider();
    expect(provider.isEnabled("proto_qr_scan")).toBe(false);
  });

  it("test code may inject an override without touching the environment", () => {
    const provider = new StaticFlagProvider({ proto_qr_scan: true });
    expect(provider.isEnabled("proto_qr_scan")).toBe(true);
    expect(provider.isEnabled("proto_draw")).toBe(false);
  });

  it("withOverride returns a new provider without mutating the original", () => {
    const base = new StaticFlagProvider({ proto_draw: false });
    const overridden = base.withOverride("proto_draw", true);
    expect(base.isEnabled("proto_draw")).toBe(false);
    expect(overridden.isEnabled("proto_draw")).toBe(true);
  });
});
