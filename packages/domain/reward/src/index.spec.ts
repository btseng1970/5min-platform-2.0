import type { Pool, PoolClient } from "pg";
import { CanonicalApiError } from "errors";
import { DrawService, type DrawResultType } from "./index";

// Node's built-in module exports are non-configurable, so jest.spyOn on
// node:crypto directly throws "Cannot redefine property". Mock the module
// instead, wrapping the real implementation so every other test in this
// file still gets genuine randomness.
jest.mock("node:crypto", () => {
  const actual = jest.requireActual<typeof import("node:crypto")>("node:crypto");
  return { ...actual, randomInt: jest.fn(actual.randomInt) };
});
const mockedCrypto = jest.requireMock<typeof import("node:crypto")>("node:crypto");

interface FakePrizeToken {
  token_id: string;
  campaign_id: string;
  prize_tier_id: string;
  status: "Available" | "Claimed";
}

interface FakeDrawLedgerRow {
  draw_id: string;
  campaign_id: string;
  member_id: string;
  idempotency_key: string;
  client_request_id: string;
  request_fingerprint: string;
  result_type: DrawResultType;
  prize_tier_id: string | null;
  point_amount: number | null;
  correlation_id: string;
}

interface FakeState {
  tokens: Map<string, FakePrizeToken>;
  ledgerByIdempotencyKey: Map<string, FakeDrawLedgerRow>;
  ledgerByDrawId: Map<string, FakeDrawLedgerRow>;
  outboxCount: number;
}

function makeQueryHandler(state: FakeState) {
  return async (sql: string, params: unknown[] = []) => {
    const text = sql.trim();

    if (text.startsWith("BEGIN") || text.startsWith("COMMIT") || text.startsWith("ROLLBACK")) {
      return { rows: [] };
    }

    if (text.includes("FROM reward.draw_ledger WHERE idempotency_key")) {
      const row = state.ledgerByIdempotencyKey.get(params[0] as string);
      return { rows: row ? [row] : [] };
    }

    if (text.includes("FROM reward.draw_ledger WHERE draw_id")) {
      const row = state.ledgerByDrawId.get(params[0] as string);
      return { rows: row ? [row] : [] };
    }

    if (text.startsWith("SELECT token_id, prize_tier_id")) {
      const campaignId = params[0] as string;
      const available = [...state.tokens.values()].find((t) => t.campaign_id === campaignId && t.status === "Available");
      return { rows: available ? [{ token_id: available.token_id, prize_tier_id: available.prize_tier_id }] : [] };
    }

    if (text.startsWith("UPDATE reward.prize_token")) {
      const tokenId = params[0] as string;
      const token = state.tokens.get(tokenId);
      if (token) {
        token.status = "Claimed";
      }
      return { rows: [] };
    }

    if (text.startsWith("INSERT INTO reward.draw_ledger")) {
      const idempotencyKey = params[3] as string;
      if (state.ledgerByIdempotencyKey.has(idempotencyKey)) {
        const error = new Error("duplicate key value violates unique constraint") as Error & { code: string };
        error.code = "23505";
        throw error;
      }
      const row: FakeDrawLedgerRow = {
        draw_id: params[0] as string,
        campaign_id: params[1] as string,
        member_id: params[2] as string,
        idempotency_key: idempotencyKey,
        client_request_id: params[4] as string,
        request_fingerprint: params[5] as string,
        result_type: params[6] as DrawResultType,
        prize_tier_id: params[7] as string | null,
        point_amount: params[8] as number | null,
        correlation_id: params[9] as string,
      };
      state.ledgerByIdempotencyKey.set(idempotencyKey, row);
      state.ledgerByDrawId.set(row.draw_id, row);
      return { rows: [] };
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

function newState(tokens: FakePrizeToken[] = []): FakeState {
  const map = new Map<string, FakePrizeToken>();
  for (const token of tokens) {
    map.set(token.token_id, token);
  }
  return { tokens: map, ledgerByIdempotencyKey: new Map(), ledgerByDrawId: new Map(), outboxCount: 0 };
}

const CAMPAIGN_ID = "demo_campaign_tw_001";
const MEMBER_ID = "demo_member_tw_001";

describe("DrawService.draw", () => {
  it("reserves a result exactly once and records it, whichever category is rolled", async () => {
    const state = newState([{ token_id: "token-1", campaign_id: CAMPAIGN_ID, prize_tier_id: "tier-gold", status: "Available" }]);
    const service = new DrawService(fakePool(state));

    const result = await service.draw({
      campaignId: CAMPAIGN_ID,
      memberId: MEMBER_ID,
      clientRequestId: "req-1",
      idempotencyKey: "idem-1",
      correlationId: "corr-1",
    });

    expect(result.state).toBe("DrawReserved");
    expect(["PRIZE", "POINT", "NO_WIN"]).toContain(result.drawResult.resultType);
    expect(state.ledgerByIdempotencyKey.get("idem-1")).toBeDefined();
    expect(state.outboxCount).toBe(1);
  });

  it("replays the original result for the same Idempotency-Key and identical payload, with no second outbox event", async () => {
    const state = newState([{ token_id: "token-1", campaign_id: CAMPAIGN_ID, prize_tier_id: "tier-gold", status: "Available" }]);
    const service = new DrawService(fakePool(state));
    const input = { campaignId: CAMPAIGN_ID, memberId: MEMBER_ID, clientRequestId: "req-2", idempotencyKey: "idem-2", correlationId: "corr-2" };

    const first = await service.draw(input);
    const second = await service.draw({ ...input, correlationId: "corr-2-retry" });

    expect(second).toEqual(first);
    expect(state.outboxCount).toBe(1);
  });

  it("rejects the same Idempotency-Key reused with a different payload as IDEMPOTENCY_CONFLICT", async () => {
    const state = newState([]);
    const service = new DrawService(fakePool(state));

    await service.draw({ campaignId: CAMPAIGN_ID, memberId: MEMBER_ID, clientRequestId: "req-3", idempotencyKey: "idem-3", correlationId: "corr-3" });

    await expect(
      service.draw({ campaignId: CAMPAIGN_ID, memberId: MEMBER_ID, clientRequestId: "req-4-different", idempotencyKey: "idem-3", correlationId: "corr-4" }),
    ).rejects.toMatchObject({ errorCode: "IDEMPOTENCY_CONFLICT" });
  });

  it("claims exactly one prize token when forced to PRIZE, and degrades to NO_WIN once sold out", async () => {
    // 0 always falls in the PRIZE bucket.
    const randomIntMock = mockedCrypto.randomInt as jest.Mock;
    randomIntMock.mockReturnValueOnce(0).mockReturnValueOnce(0);

    const state = newState([{ token_id: "token-1", campaign_id: CAMPAIGN_ID, prize_tier_id: "tier-gold", status: "Available" }]);
    const service = new DrawService(fakePool(state));

    const first = await service.draw({ campaignId: CAMPAIGN_ID, memberId: MEMBER_ID, clientRequestId: "req-5", idempotencyKey: "idem-5", correlationId: "corr-5" });
    expect(first.drawResult).toEqual({ resultType: "PRIZE", prizeTier: "tier-gold" });
    expect(state.tokens.get("token-1")?.status).toBe("Claimed");

    const second = await service.draw({ campaignId: CAMPAIGN_ID, memberId: MEMBER_ID, clientRequestId: "req-6", idempotencyKey: "idem-6", correlationId: "corr-6" });
    expect(second.drawResult).toEqual({ resultType: "NO_WIN", prizeTier: null });
  });

  it("getById returns the stored draw result", async () => {
    const state = newState([]);
    const service = new DrawService(fakePool(state));
    const created = await service.draw({ campaignId: CAMPAIGN_ID, memberId: MEMBER_ID, clientRequestId: "req-7", idempotencyKey: "idem-7", correlationId: "corr-7" });

    const fetched = await service.getById(created.drawId);

    expect(fetched).toEqual(created);
  });

  it("throws RESOURCE_NOT_FOUND for an unknown draw_id", async () => {
    const state = newState([]);
    const service = new DrawService(fakePool(state));

    await expect(service.getById("nonexistent")).rejects.toThrow(CanonicalApiError);
    await expect(service.getById("nonexistent")).rejects.toMatchObject({ errorCode: "RESOURCE_NOT_FOUND" });
  });
});
