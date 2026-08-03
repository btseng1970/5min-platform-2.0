#!/usr/bin/env node
// Deterministic Prototype seed/reset (FND-009 minimum subset). Produces the
// same fixture rows every run — never invents randomness in the seed data
// itself (the *draw* remains genuinely random; the *seed data* must not be).
// No production PII of any kind is written by this script.

import pg from "pg";

const { Pool } = pg;

const DEMO_CAMPAIGN = {
  campaign_id: "demo_campaign_tw_001",
  market_id: "TW",
  name: "5min Coffee Demo Campaign (TW)",
  status: "Active",
};

async function seedCampaign(pool) {
  await pool.query(
    `INSERT INTO campaign.campaign (campaign_id, market_id, name, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (campaign_id) DO UPDATE
       SET market_id = EXCLUDED.market_id,
           name = EXCLUDED.name,
           status = EXCLUDED.status,
           updated_at = now()`,
    [DEMO_CAMPAIGN.campaign_id, DEMO_CAMPAIGN.market_id, DEMO_CAMPAIGN.name, DEMO_CAMPAIGN.status],
  );
  console.log(`PASS seed:campaign — ${DEMO_CAMPAIGN.campaign_id}`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log("FAIL (none) :: MIG029_MISSING_DATABASE_URL :: DATABASE_URL is not set");
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await seedCampaign(pool);
    console.log("Seed complete.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[INTERNAL ERROR] seed failed: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
