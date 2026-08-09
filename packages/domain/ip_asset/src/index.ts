// IP asset (collection) domain service. Reads and writes only ip_asset.* —
// the schema this package owns. No constructor parameter properties (see
// packages/shared/money/src/index.ts for why that matters at runtime).
//
// Unlock state is idempotent per (member_id, item_id): winning the same
// prize tier more than once (e.g. via a replayed draw, or genuinely
// drawing the same tier twice) never produces more than one unlocked
// entry for a member — collection membership is a boolean state, not a
// count. There is no standalone GET /api/v1/collection route; collection
// data is composed into GET /api/v1/me only, per the binding
// read-composition rule confirmed during governance materialization.

import type { Pool } from "pg";
import { randomUUID } from "node:crypto";

export interface CollectionEntry {
  itemId: string;
  unlocked: boolean;
}

export interface UnlockFromPrizeDrawInput {
  memberId: string;
  prizeTierId: string;
  drawId: string;
  correlationId: string;
}

export class CollectionService {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getCollection(memberId: string, campaignId: string): Promise<CollectionEntry[]> {
    const result = await this.pool.query<{ item_id: string; unlocked: boolean }>(
      `SELECT ci.item_id, (mu.unlock_id IS NOT NULL) AS unlocked
       FROM ip_asset.collection_item ci
       LEFT JOIN ip_asset.member_unlock mu ON mu.item_id = ci.item_id AND mu.member_id = $1
       WHERE ci.campaign_id = $2
       ORDER BY ci.item_id`,
      [memberId, campaignId],
    );
    return result.rows.map((row) => ({ itemId: row.item_id, unlocked: row.unlocked }));
  }

  async unlockFromPrizeDraw(input: UnlockFromPrizeDrawInput): Promise<void> {
    const itemResult = await this.pool.query<{ item_id: string }>(
      `SELECT item_id FROM ip_asset.collection_item WHERE linked_prize_tier_id = $1`,
      [input.prizeTierId],
    );
    const item = itemResult.rows[0];
    if (!item) {
      // No collection item is configured for this prize tier — nothing to
      // unlock. Not an error: seed data may legitimately leave a tier
      // without a linked collectible.
      return;
    }

    await this.pool.query(
      `INSERT INTO ip_asset.member_unlock (unlock_id, member_id, item_id, source_type, source_id, correlation_id, created_at)
       VALUES ($1, $2, $3, 'DRAW_PRIZE', $4, $5, now())
       ON CONFLICT (member_id, item_id) DO NOTHING`,
      [randomUUID(), input.memberId, item.item_id, input.drawId, input.correlationId],
    );
  }
}
