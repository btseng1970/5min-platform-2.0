import type { Pool, PoolClient } from "pg";
import { CanonicalApiError } from "errors";
import { HmacQrCodeVerifier, QrService } from "./index";

interface FakeQrCode {
  qr_code_id: string;
  campaign_id: string;
  status: "Unused" | "Used" | "Inactive";
}

interface FakeScanEvent {
  qr_code_id: string;
  client_request_id: string;
  request_fingerprint: string;
  outcome_json: unknown;
  result_code: string;
}

interface FakeState {
  qrCodes: Map<string, FakeQrCode>; // keyed by code_hash
  scanEvents: Map<string, FakeScanEvent>; // keyed by client_request_id
  outboxCount: number;
  allParamsEverSent: unknown[][];
}

function makeQueryHandler(state: FakeState) {
  return async (sql: string, params: unknown[] = []) => {
    state.allParamsEverSent.push(params);
    const text = sql.trim();

    if (text.startsWith("BEGIN") || text.startsWith("COMMIT") || text.startsWith("ROLLBACK")) {
      return { rows: [] };
    }

    if (text.startsWith("SELECT request_fingerprint, outcome_json FROM qr.scan_event")) {
      const clientRequestId = params[0] as string;
      const row = state.scanEvents.get(clientRequestId);
      return { rows: row ? [{ request_fingerprint: row.request_fingerprint, outcome_json: row.outcome_json }] : [] };
    }

    if (text.startsWith("SELECT qr_code_id, campaign_id, status FROM qr.code")) {
      const codeHash = params[0] as string;
      const row = state.qrCodes.get(codeHash);
      return { rows: row ? [row] : [] };
    }

    if (text.startsWith("UPDATE qr.code")) {
      const qrCodeId = params[0] as string;
      for (const row of state.qrCodes.values()) {
        if (row.qr_code_id === qrCodeId) {
          row.status = "Used";
        }
      }
      return { rows: [] };
    }

    if (text.startsWith("INSERT INTO qr.scan_event")) {
      const clientRequestId = params[3] as string;
      const isOnConflict = text.includes("ON CONFLICT");
      if (state.scanEvents.has(clientRequestId)) {
        if (isOnConflict) {
          return { rows: [] };
        }
        const error = new Error("duplicate key value violates unique constraint") as Error & { code: string };
        error.code = "23505";
        throw error;
      }
      state.scanEvents.set(clientRequestId, {
        qr_code_id: params[1] as string,
        client_request_id: clientRequestId,
        request_fingerprint: params[4] as string,
        outcome_json: JSON.parse(params[6] as string),
        result_code: params[7] as string,
      });
      return { rows: [{ scan_event_id: params[0] }] };
    }

    if (text.startsWith("INSERT INTO platform.event_outbox")) {
      state.outboxCount += 1;
      return { rows: [] };
    }

    throw new Error(`Unexpected query in test: ${text}`);
  };
}

function fakePool(state: FakeState): Pool {
  const handler = makeQueryHandler(state);
  const client = { query: jest.fn(handler), release: jest.fn() } as unknown as PoolClient;
  return {
    query: jest.fn(handler),
    connect: jest.fn(async () => client),
  } as unknown as Pool;
}

const SECRET = "test-only-secret";
const verifier = new HmacQrCodeVerifier(SECRET);
const MEMBER_ID = "demo_member_tw_001";

interface SeedCode {
  qrCodeId: string;
  rawCode: string;
  campaignId: string;
  status: FakeQrCode["status"];
}

function newState(codes: SeedCode[] = []): FakeState {
  const qrCodes = new Map<string, FakeQrCode>();
  for (const code of codes) {
    qrCodes.set(verifier.hash(code.rawCode), {
      qr_code_id: code.qrCodeId,
      campaign_id: code.campaignId,
      status: code.status,
    });
  }
  return { qrCodes, scanEvents: new Map(), outboxCount: 0, allParamsEverSent: [] };
}

describe("QrService.scan", () => {
  it("claims an unused code exactly once, records success, and emits exactly one QRCodeScanned outbox event", async () => {
    const state = newState([
      { qrCodeId: "demo_qr_tw_001", rawCode: "SIGNED-RAW-001", campaignId: "demo_campaign_tw_001", status: "Unused" },
    ]);
    const service = new QrService(fakePool(state), verifier);

    const result = await service.scan({
      rawCode: "SIGNED-RAW-001",
      memberId: MEMBER_ID,
      clientRequestId: "req-1",
      correlationId: "corr-1",
    });

    expect(result).toEqual({ qrCodeId: "demo_qr_tw_001", state: "USED" });
    expect(state.qrCodes.get(verifier.hash("SIGNED-RAW-001"))?.status).toBe("Used");
    expect(state.outboxCount).toBe(1);
  });

  it("never sends the raw QR value as a parameter to any query — only its hash", async () => {
    const state = newState([
      { qrCodeId: "demo_qr_tw_001", rawCode: "SIGNED-RAW-001", campaignId: "demo_campaign_tw_001", status: "Unused" },
    ]);
    const service = new QrService(fakePool(state), verifier);
    const rawValue = "SIGNED-RAW-001";

    await service.scan({ rawCode: rawValue, memberId: MEMBER_ID, clientRequestId: "req-1", correlationId: "corr-1" });

    expect(verifier.hash(rawValue)).not.toBe(rawValue);
    for (const params of state.allParamsEverSent) {
      expect(params).not.toContain(rawValue);
    }
  });

  it("rejects a code whose hash is unknown (invalid signature) as RESOURCE_NOT_FOUND", async () => {
    const state = newState([]);
    const service = new QrService(fakePool(state), verifier);
    const input = { rawCode: "not-a-real-code", memberId: MEMBER_ID, clientRequestId: "req-2", correlationId: "corr-2" };

    await expect(service.scan(input)).rejects.toThrow(CanonicalApiError);
    await expect(service.scan(input)).rejects.toMatchObject({ errorCode: "RESOURCE_NOT_FOUND" });
  });

  it("rejects an Inactive code as STATE_CONFLICT and records a failure scan_event via a separate write", async () => {
    const state = newState([
      { qrCodeId: "demo_qr_tw_002", rawCode: "SIGNED-RAW-002", campaignId: "demo_campaign_tw_001", status: "Inactive" },
    ]);
    const service = new QrService(fakePool(state), verifier);
    const input = { rawCode: "SIGNED-RAW-002", memberId: MEMBER_ID, clientRequestId: "req-3", correlationId: "corr-3" };

    await expect(service.scan(input)).rejects.toMatchObject({ errorCode: "STATE_CONFLICT", details: { reason: "INACTIVE" } });
    expect(state.scanEvents.get("req-3")?.result_code).toBe("INACTIVE");
    expect(state.qrCodes.get(verifier.hash("SIGNED-RAW-002"))?.status).toBe("Inactive");
  });

  it("rejects an already-used code scanned with a different client_request_id as STATE_CONFLICT / ALREADY_USED and records the failure", async () => {
    const state = newState([
      { qrCodeId: "demo_qr_tw_003", rawCode: "SIGNED-RAW-003", campaignId: "demo_campaign_tw_001", status: "Used" },
    ]);
    const service = new QrService(fakePool(state), verifier);
    const input = { rawCode: "SIGNED-RAW-003", memberId: MEMBER_ID, clientRequestId: "req-4", correlationId: "corr-4" };

    await expect(service.scan(input)).rejects.toMatchObject({ errorCode: "STATE_CONFLICT", details: { reason: "ALREADY_USED" } });
    expect(state.scanEvents.get("req-4")?.result_code).toBe("ALREADY_USED");
  });

  it("replays the original success result for the same client_request_id and identical payload, with no second outbox event", async () => {
    const state = newState([
      { qrCodeId: "demo_qr_tw_004", rawCode: "SIGNED-RAW-004", campaignId: "demo_campaign_tw_001", status: "Unused" },
    ]);
    const service = new QrService(fakePool(state), verifier);
    const input = { rawCode: "SIGNED-RAW-004", memberId: MEMBER_ID, clientRequestId: "req-5", correlationId: "corr-5" };

    const first = await service.scan(input);
    const second = await service.scan({ ...input, correlationId: "corr-5-retry" });

    expect(second).toEqual(first);
    expect(state.outboxCount).toBe(1);
  });

  it("replays the original failure result for the same client_request_id and identical payload", async () => {
    const state = newState([
      { qrCodeId: "demo_qr_tw_005", rawCode: "SIGNED-RAW-005", campaignId: "demo_campaign_tw_001", status: "Used" },
    ]);
    const service = new QrService(fakePool(state), verifier);
    const input = { rawCode: "SIGNED-RAW-005", memberId: MEMBER_ID, clientRequestId: "req-6", correlationId: "corr-6" };

    await expect(service.scan(input)).rejects.toMatchObject({ errorCode: "STATE_CONFLICT" });
    await expect(service.scan(input)).rejects.toMatchObject({ errorCode: "STATE_CONFLICT", details: { reason: "ALREADY_USED" } });
  });

  it("rejects the same client_request_id reused with a different payload as IDEMPOTENCY_CONFLICT, without touching the second code", async () => {
    const state = newState([
      { qrCodeId: "demo_qr_tw_006", rawCode: "SIGNED-RAW-006", campaignId: "demo_campaign_tw_001", status: "Unused" },
      { qrCodeId: "demo_qr_tw_007", rawCode: "SIGNED-RAW-007", campaignId: "demo_campaign_tw_001", status: "Unused" },
    ]);
    const service = new QrService(fakePool(state), verifier);

    await service.scan({ rawCode: "SIGNED-RAW-006", memberId: MEMBER_ID, clientRequestId: "req-7", correlationId: "corr-7" });

    await expect(
      service.scan({ rawCode: "SIGNED-RAW-007", memberId: MEMBER_ID, clientRequestId: "req-7", correlationId: "corr-8" }),
    ).rejects.toMatchObject({ errorCode: "IDEMPOTENCY_CONFLICT" });

    expect(state.qrCodes.get(verifier.hash("SIGNED-RAW-007"))?.status).toBe("Unused");
  });

  it("preserves the caller's correlation_id on the recorded scan_event", async () => {
    const state = newState([
      { qrCodeId: "demo_qr_tw_008", rawCode: "SIGNED-RAW-008", campaignId: "demo_campaign_tw_001", status: "Unused" },
    ]);
    const service = new QrService(fakePool(state), verifier);

    await service.scan({ rawCode: "SIGNED-RAW-008", memberId: MEMBER_ID, clientRequestId: "req-9", correlationId: "corr-9" });

    const insertCall = state.allParamsEverSent.find((params) => params[5] === "corr-9");
    expect(insertCall).toBeDefined();
  });
});
