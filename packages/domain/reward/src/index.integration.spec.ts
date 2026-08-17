// Real-PostgreSQL integration test — proves no-oversell under genuine
// concurrent connections: SKIP LOCKED behavior is a real database
// mechanism a fake Pool cannot simulate. Skipped when DATABASE_URL is not
// set. Every other assertion in this package runs against a fake Pool.

import pg from "pg";
import { randomUUID } from "node:crypto";
import { DrawService } from "./index";

const { Pool } = pg;

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("DrawService.draw — real Postgres no-oversell under concurrency", () => {
  let pool: InstanceType<typeof Pool>;

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("never claims more prize tokens than exist, even with many concurrent draws", async () => {
    const campaignId = `integration_test_campaign_${randomUUID()}`;
    const tierId = `integration_test_tier_${randomUUID()}`;
    const tokenCount = 3;
    const drawCount = 20;

    await pool.query(`INSERT INTO reward.prize_tier (prize_tier_id, campaign_id, tier_name) VALUES ($1, $2, 'Integration Test Tier')`, [
      tierId,
      campaignId,
    ]);
    const tokenIds = Array.from({ length: tokenCount }, () => randomUUID());
    for (const tokenId of tokenIds) {
      await pool.query(
        `INSERT INTO reward.prize_token (token_id, campaign_id, prize_tier_id, status) VALUES ($1, $2, $3, 'Available')`,
        [tokenId, campaignId, tierId],
      );
    }

    let drawIds: string[] = [];
    try {
      const services = Array.from({ length: drawCount }, () => new DrawService(pool));

      const outcomes = await Promise.all(
        services.map((service, index) =>
          service.draw({
            campaignId,
            memberId: `integration_test_member_${index}`,
            clientRequestId: `req-${index}-${randomUUID()}`,
            idempotencyKey: `idem-${index}-${randomUUID()}`,
            correlationId: `integration-corr-${index}`,
          }),
        ),
      );

      drawIds = outcomes.map((o) => o.drawId);
      const prizeOutcomes = outcomes.filter((o) => o.drawResult.resultType === "PRIZE");
      expect(prizeOutcomes.length).toBeLessThanOrEqual(tokenCount);

      const claimedTokenIds = new Set(prizeOutcomes.map((o) => o.drawId));
      expect(claimedTokenIds.size).toBe(prizeOutcomes.length); // every PRIZE draw is a distinct draw_id

      const tokenRows = await pool.query(`SELECT status FROM reward.prize_token WHERE campaign_id = $1 AND status = 'Claimed'`, [
        campaignId,
      ]);
      expect(tokenRows.rows.length).toBe(prizeOutcomes.length);
      expect(tokenRows.rows.length).toBeLessThanOrEqual(tokenCount);

      const ledgerRows = await pool.query(`SELECT draw_id FROM reward.draw_ledger WHERE campaign_id = $1`, [campaignId]);
      expect(ledgerRows.rows.length).toBe(drawCount); // every draw request produced exactly one ledger row
    } finally {
      if (drawIds.length > 0) {
        await pool.query(`DELETE FROM platform.event_outbox WHERE aggregate_id = ANY($1::text[]) AND event_type = 'DrawReserved'`, [
          drawIds,
        ]);
      }
      await pool.query(`DELETE FROM reward.draw_ledger WHERE campaign_id = $1`, [campaignId]);
      await pool.query(`DELETE FROM reward.prize_token WHERE campaign_id = $1`, [campaignId]);
      await pool.query(`DELETE FROM reward.prize_tier WHERE campaign_id = $1`, [campaignId]);
    }
  });
});
