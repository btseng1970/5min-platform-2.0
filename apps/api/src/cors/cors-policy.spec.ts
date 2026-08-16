import { resolveCorsPolicy } from "./cors-policy";

describe("resolveCorsPolicy", () => {
  it("is fully restrictive (no allowed origin) when the env var is unset — the production/zero-config default", () => {
    expect(resolveCorsPolicy({})).toEqual({ origin: false });
  });

  it("is fully restrictive when the env var is set to an empty string", () => {
    expect(resolveCorsPolicy({ PROTOTYPE_DEMO_ALLOWED_ORIGINS: "" })).toEqual({ origin: false });
  });

  it("is fully restrictive when the env var contains only whitespace/commas", () => {
    expect(resolveCorsPolicy({ PROTOTYPE_DEMO_ALLOWED_ORIGINS: " , ," })).toEqual({ origin: false });
  });

  it("allows exactly one explicitly configured local demo origin", () => {
    expect(resolveCorsPolicy({ PROTOTYPE_DEMO_ALLOWED_ORIGINS: "http://localhost:3001" })).toEqual({
      origin: ["http://localhost:3001"],
    });
  });

  it("allows multiple explicitly configured origins, trimmed", () => {
    expect(
      resolveCorsPolicy({ PROTOTYPE_DEMO_ALLOWED_ORIGINS: "http://localhost:3001, http://localhost:3002 " }),
    ).toEqual({ origin: ["http://localhost:3001", "http://localhost:3002"] });
  });

  it("never returns a wildcard or reflected-origin policy regardless of input", () => {
    const result = resolveCorsPolicy({ PROTOTYPE_DEMO_ALLOWED_ORIGINS: "*" });
    expect(result.origin).not.toBe(true);
    expect(result.origin).not.toBe("*");
    expect(result).toEqual({ origin: ["*"] }); // treated as a literal (unmatchable) origin string, not a wildcard
  });

  it("simulates a production runtime with zero PROTOTYPE_* configuration and asserts CORS is restrictive", () => {
    const productionLikeEnv: Record<string, string | undefined> = {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://prod-would-be-here",
    };
    expect(resolveCorsPolicy(productionLikeEnv)).toEqual({ origin: false });
  });
});
