#!/usr/bin/env node
// Deterministic Prototype seed/reset (FND-009 minimum subset). Produces the
// same fixture rows every run — never invents randomness in the seed data
// itself (the *draw* remains genuinely random; the *seed data* must not be).
// No production PII of any kind is written by this script.

import pg from "pg";
import { DEMO_CAMPAIGN_ID, DEMO_MEMBER_ID, DEMO_MEMBER_DISPLAY_NAME } from "test-fixtures";
import { HmacQrCodeVerifier, PROTOTYPE_QR_SIGNING_SECRET_FALLBACK } from "@5min/domain-qr";

const { Pool } = pg;

const DEMO_CAMPAIGN = {
  campaign_id: DEMO_CAMPAIGN_ID,
  market_id: "TW",
  name: "5min Coffee Demo Campaign (TW)",
  status: "Active",
};

const DEMO_MEMBER = {
  member_id: DEMO_MEMBER_ID,
  display_name: DEMO_MEMBER_DISPLAY_NAME,
};

const DEMO_QR_CODE_COUNT = 20;

// Same secret-resolution rule as apps/api/src/qr/qr.module.ts: prototype-only,
// never a production key. The verifier only ever produces a hash — seed
// tooling never persists the raw value to qr.code, only its hash.
const verifier = new HmacQrCodeVerifier(process.env.QR_SIGNING_SECRET ?? PROTOTYPE_QR_SIGNING_SECRET_FALLBACK);

function buildDemoQrCodes() {
  return Array.from({ length: DEMO_QR_CODE_COUNT }, (_, index) => {
    const sequence = String(index + 1).padStart(3, "0");
    return {
      qr_code_id: `demo_qr_tw_${sequence}`,
      raw_code: `SIGNED-DEMO-QR-TW-${sequence}`,
      campaign_id: DEMO_CAMPAIGN_ID,
    };
  });
}

const DEMO_PRIZE_TIERS = [
  { prize_tier_id: "demo_tier_gold", tier_name: "Gold", token_count: 2 },
  { prize_tier_id: "demo_tier_silver", tier_name: "Silver", token_count: 5 },
  { prize_tier_id: "demo_tier_bronze", tier_name: "Bronze", token_count: 10 },
];

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

async function seedMember(pool) {
  await pool.query(
    `INSERT INTO crm.member (member_id, display_name)
     VALUES ($1, $2)
     ON CONFLICT (member_id) DO UPDATE
       SET display_name = EXCLUDED.display_name`,
    [DEMO_MEMBER.member_id, DEMO_MEMBER.display_name],
  );
  console.log(`PASS seed:member — ${DEMO_MEMBER.member_id}`);
}

async function seedQrCodes(pool) {
  const demoQrCodes = buildDemoQrCodes();
  for (const code of demoQrCodes) {
    const codeHash = verifier.hash(code.raw_code);
    await pool.query(
      `INSERT INTO qr.code (qr_code_id, code_hash, campaign_id, status, used_by_member_id, used_at)
       VALUES ($1, $2, $3, 'Unused', NULL, NULL)
       ON CONFLICT (qr_code_id) DO UPDATE
         SET code_hash = EXCLUDED.code_hash,
             campaign_id = EXCLUDED.campaign_id,
             status = 'Unused',
             used_by_member_id = NULL,
             used_at = NULL`,
      [code.qr_code_id, codeHash, code.campaign_id],
    );
  }
  console.log(`PASS seed:qr-codes — ${demoQrCodes.length} deterministic demo codes reset to Unused`);
  // Operator-facing enrollment output only, produced once at seed time — not
  // part of the runtime request-handling path, which never logs raw values.
  console.log("Demo QR raw values for manual scanning (seed-time only, never persisted in plaintext):");
  for (const code of demoQrCodes) {
    console.log(`  ${code.qr_code_id}: ${code.raw_code}`);
  }
}

async function seedRewardPool(pool) {
  for (const tier of DEMO_PRIZE_TIERS) {
    await pool.query(
      `INSERT INTO reward.prize_tier (prize_tier_id, campaign_id, tier_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (prize_tier_id) DO UPDATE
         SET campaign_id = EXCLUDED.campaign_id,
             tier_name = EXCLUDED.tier_name`,
      [tier.prize_tier_id, DEMO_CAMPAIGN_ID, tier.tier_name],
    );
    for (let i = 1; i <= tier.token_count; i += 1) {
      const tokenId = `demo_prize_token_${tier.prize_tier_id}_${String(i).padStart(3, "0")}`;
      await pool.query(
        `INSERT INTO reward.prize_token (token_id, campaign_id, prize_tier_id, status, claimed_by_draw_id, claimed_at)
         VALUES ($1, $2, $3, 'Available', NULL, NULL)
         ON CONFLICT (token_id) DO UPDATE
           SET campaign_id = EXCLUDED.campaign_id,
               prize_tier_id = EXCLUDED.prize_tier_id,
               status = 'Available',
               claimed_by_draw_id = NULL,
               claimed_at = NULL`,
        [tokenId, DEMO_CAMPAIGN_ID, tier.prize_tier_id],
      );
    }
  }
  const totalTokens = DEMO_PRIZE_TIERS.reduce((sum, tier) => sum + tier.token_count, 0);
  console.log(`PASS seed:reward-pool — ${DEMO_PRIZE_TIERS.length} tiers, ${totalTokens} prize tokens reset to Available`);
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
    await seedMember(pool);
    await seedQrCodes(pool);
    await seedRewardPool(pool);
    console.log("Seed complete.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[INTERNAL ERROR] seed failed: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
});
