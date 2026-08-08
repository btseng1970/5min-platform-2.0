// Reward domain service. Reads and writes only reward.* — the schema this
// package owns. No constructor parameter properties (see
// packages/shared/money/src/index.ts for why that matters at runtime).
//
// DrawReserved-time result determination: the random outcome (PRIZE / POINT
// / NO_WIN, and which prize token if PRIZE) is decided exactly once, inside
// the transaction that inserts the immutable reward.draw_ledger row. A
// replay of the same Idempotency-Key never re-executes the random
// selection — it only ever reads back the already-committed row. No
// settlement rerandomization is possible because there is no code path
// that updates an existing draw_ledger row.
//
// No oversell: prize inventory is modeled as individual claimable token
// rows (reward.prize_token) — per CLAUDE.md's GA rule, draws use DB
// SKIP LOCKED, never a Redis/memory token source. A draw claims one
// available token via SELECT ... FOR UPDATE SKIP LOCKED, which lets
// concurrent draws proceed against disjoint tokens without blocking each
// other and makes claiming the same token twice structurally impossible.
// If no token is available (sold out), the draw degrades to NO_WIN rather
// than erroring.
//
// Idempotency: keyed by the caller's Idempotency-Key, with a request
// fingerprint (hash of campaign_id + client_request_id) guarding against
// the same key being reused for a different logical request
// (IDEMPOTENCY_CONFLICT). The database's UNIQUE(idempotency_key)
// constraint is the actual race-closing mechanism for two truly
// concurrent identical retries: at most one insert can ever win, and the
// loser's transaction — including any token it may have spuriously
// claimed — rolls back in full before this service re-reads and returns
// the winner's result.

import type { Pool, PoolClient } from "pg";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { CanonicalApiError } from "errors";
import { withTransaction, writeOutboxEvent } from "@5min/shared-db";

export type DrawResultType = "PRIZE" | "POINT" | "NO_WIN";

export interface DrawInput {
  campaignId: string;
  memberId: string;
  clientRequestId: string;
  idempotencyKey: string;
  correlationId: string;
}

export interface DrawResult {
  drawId: string;
  state: "DrawReserved";
  drawResult: {
    resultType: DrawResultType;
    prizeTier: string | null;
    pointAmount: number | null;
  };
}

/** Fixed integer point award for a POINT outcome — no float, per GA rule. */
const DEMO_POINT_AWARD = 100;

const CATEGORY_WEIGHTS: ReadonlyArray<{ category: DrawResultType; weight: number }> = [
  { category: "PRIZE", weight: 20 },
  { category: "POINT", weight: 30 },
  { category: "NO_WIN", weight: 50 },
];
const TOTAL_WEIGHT = CATEGORY_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0);

function pickCategory(): DrawResultType {
  const roll = randomInt(TOTAL_WEIGHT);
  let cumulative = 0;
  for (const entry of CATEGORY_WEIGHTS) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      return entry.category;
    }
  }
  return "NO_WIN";
}

function computeFingerprint(campaignId: string, clientRequestId: string): string {
  return createHash("sha256").update(JSON.stringify({ campaignId, clientRequestId })).digest("hex");
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

// A type alias, not an interface: interfaces don't structurally satisfy the
// Record<string, unknown> constraint on Queryable.query<T> below, even with
// identical shape — a documented TS quirk for generic constraints against
// mapped/index types.
type DrawLedgerRow = {
  draw_id: string;
  result_type: DrawResultType;
  prize_tier_id: string | null;
  point_amount: number | null;
  request_fingerprint: string;
};

function toDrawResult(row: DrawLedgerRow): DrawResult {
  return {
    drawId: row.draw_id,
    state: "DrawReserved",
    drawResult: { resultType: row.result_type, prizeTier: row.prize_tier_id, pointAmount: row.point_amount },
  };
}

export class DrawService {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async draw(input: DrawInput): Promise<DrawResult> {
    const fingerprint = computeFingerprint(input.campaignId, input.clientRequestId);

    const precheck = await this.checkIdempotency(this.pool, input.idempotencyKey, fingerprint);
    if (precheck) {
      return precheck;
    }

    try {
      return await withTransaction(this.pool, (client) => this.attemptDraw(client, input, fingerprint));
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await this.checkIdempotency(this.pool, input.idempotencyKey, fingerprint);
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  async getById(drawId: string): Promise<DrawResult> {
    const result = await this.pool.query<DrawLedgerRow>(
      `SELECT draw_id, result_type, prize_tier_id, point_amount, request_fingerprint FROM reward.draw_ledger WHERE draw_id = $1`,
      [drawId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", `Draw ${drawId} does not exist.`);
    }
    return toDrawResult(row);
  }

  private async checkIdempotency(
    queryable: Queryable,
    idempotencyKey: string,
    fingerprint: string,
  ): Promise<DrawResult | undefined> {
    const result = await queryable.query<DrawLedgerRow>(
      `SELECT draw_id, result_type, prize_tier_id, point_amount, request_fingerprint FROM reward.draw_ledger WHERE idempotency_key = $1`,
      [idempotencyKey],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    if (row.request_fingerprint !== fingerprint) {
      throw new CanonicalApiError(
        "IDEMPOTENCY_CONFLICT",
        `Idempotency-Key ${idempotencyKey} was already used with a different request.`,
      );
    }
    return toDrawResult(row);
  }

  private async attemptDraw(client: PoolClient, input: DrawInput, fingerprint: string): Promise<DrawResult> {
    const drawId = randomUUID();
    const category = pickCategory();

    let resultType: DrawResultType = "NO_WIN";
    let prizeTierId: string | null = null;
    let pointAmount: number | null = null;

    if (category === "PRIZE") {
      const claimResult = await client.query<{ token_id: string; prize_tier_id: string }>(
        `SELECT token_id, prize_tier_id
         FROM reward.prize_token
         WHERE campaign_id = $1 AND status = 'Available'
         ORDER BY random()
         FOR UPDATE SKIP LOCKED
         LIMIT 1`,
        [input.campaignId],
      );
      const token = claimResult.rows[0];
      if (token) {
        await client.query(
          `UPDATE reward.prize_token SET status = 'Claimed', claimed_by_draw_id = $2, claimed_at = now() WHERE token_id = $1`,
          [token.token_id, drawId],
        );
        resultType = "PRIZE";
        prizeTierId = token.prize_tier_id;
      }
      // No token available (sold out): degrades to NO_WIN below.
    } else if (category === "POINT") {
      resultType = "POINT";
      pointAmount = DEMO_POINT_AWARD;
    }

    await client.query(
      `INSERT INTO reward.draw_ledger
         (draw_id, campaign_id, member_id, idempotency_key, client_request_id, request_fingerprint,
          result_type, prize_tier_id, point_amount, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())`,
      [
        drawId,
        input.campaignId,
        input.memberId,
        input.idempotencyKey,
        input.clientRequestId,
        fingerprint,
        resultType,
        prizeTierId,
        pointAmount,
        input.correlationId,
      ],
    );

    await writeOutboxEvent(client, {
      eventId: randomUUID(),
      eventType: "DrawReserved",
      aggregateType: "draw",
      aggregateId: drawId,
      aggregateVersion: 1,
      payload: {
        draw_id: drawId,
        campaign_id: input.campaignId,
        member_id: input.memberId,
        result_type: resultType,
        prize_tier_id: prizeTierId,
        point_amount: pointAmount,
        correlation_id: input.correlationId,
        occurred_at: new Date().toISOString(),
      },
      correlationId: input.correlationId,
    });

    return {
      drawId,
      state: "DrawReserved",
      drawResult: { resultType, prizeTier: prizeTierId, pointAmount },
    };
  }
}
