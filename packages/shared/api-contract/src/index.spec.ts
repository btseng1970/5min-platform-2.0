// Contract test: proves this client's parsed result exposes the exact
// snake_case field names the real backend actually returns (per
// docs/openapi/openapi.yaml), using response fixtures shaped exactly like
// real controller output. This is the regression guard for the specific
// bug class fixed in commit 87e29ae — a hand-rolled camelCase interface
// silently drifting out of sync with the real (snake_case) API response,
// undetected because fetch().json() returns `any`. If this client's field
// names ever drift back to camelCase, these assertions fail immediately.

import { createApiClient } from "./index";

const BASE_URL = "http://localhost:9999";

function mockFetchOnce(status: number, body: unknown): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  (global as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("api-contract client", () => {
  it("getCurrentCampaign exposes snake_case fields exactly as the real controller returns them", async () => {
    mockFetchOnce(200, { campaign_id: "demo_campaign_tw_001", market_id: "TW", name: "Demo", status: "Active" });
    const client = createApiClient(BASE_URL);

    const result = await client.getCurrentCampaign();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.campaign_id).toBe("demo_campaign_tw_001");
      expect(result.body.market_id).toBe("TW");
    }
  });

  it("scanQr sends the documented request shape and exposes qr_code_id/state on success", async () => {
    const fetchMock = mockFetchOnce(200, { qr_code_id: "demo_qr_tw_001", state: "USED" });
    const client = createApiClient(BASE_URL);

    const result = await client.scanQr({ code: "RAW-CODE", client_request_id: "req-1" }, { correlationId: "corr-1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.qr_code_id).toBe("demo_qr_tw_001");
      expect(result.body.state).toBe("USED");
    }
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ code: "RAW-CODE", client_request_id: "req-1" });
    expect((init.headers as Record<string, string>)["x-correlation-id"]).toBe("corr-1");
  });

  it("createDraw sends the Idempotency-Key header and exposes draw_result.point_amount", async () => {
    const fetchMock = mockFetchOnce(200, {
      draw_id: "draw-1",
      state: "DrawReserved",
      draw_result: { result_type: "POINT", prize_tier: null, point_amount: 100 },
    });
    const client = createApiClient(BASE_URL);

    const result = await client.createDraw(
      { campaign_id: "demo_campaign_tw_001", client_request_id: "req-1" },
      "idem-1",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.draw_result.point_amount).toBe(100);
    }
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("idem-1");
  });

  it("getMemberCenter exposes wallet_summary.available_points and collection[].unlocked", async () => {
    mockFetchOnce(200, {
      member_id: "demo_member_tw_001",
      display_name: "Demo Member (TW)",
      wallet_summary: { available_points: 500 },
      collection: [{ item_id: "demo_item_gold", unlocked: true }],
    });
    const client = createApiClient(BASE_URL);

    const result = await client.getMemberCenter();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.wallet_summary.available_points).toBe(500);
      expect(result.body.collection[0]).toEqual({ item_id: "demo_item_gold", unlocked: true });
    }
  });

  it("getAdminAuditLog returns a CanonicalErrorEnvelope shape on failure, never throwing", async () => {
    mockFetchOnce(404, { error_code: "RESOURCE_NOT_FOUND", message: "x", details: null, correlation_id: "c", retry_after_seconds: null });
    const client = createApiClient(BASE_URL);

    const result = await client.getAdminAuditLog("corr-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.body?.error_code).toBe("RESOURCE_NOT_FOUND");
    }
  });
});
