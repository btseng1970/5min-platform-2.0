// Campaign domain service. Reads only campaign.* — the schema this package
// owns — never any other context's schema (Cross-schema Write Ban, extended
// here to the same "no reach across a boundary except through a defined
// contract" read discipline). No constructor parameter properties (see
// packages/shared/money/src/index.ts for why that matters at runtime).

import type { Pool } from "pg";
import { CanonicalApiError } from "errors";

export interface CampaignSummary {
  campaignId: string;
  marketId: string;
  name: string;
  status: "Draft" | "Active" | "Ending" | "Archived" | "Hidden";
}

export class CampaignService {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getCurrent(): Promise<CampaignSummary> {
    const result = await this.pool.query<{
      campaign_id: string;
      market_id: string;
      name: string;
      status: CampaignSummary["status"];
    }>(
      `SELECT campaign_id, market_id, name, status
       FROM campaign.campaign
       WHERE status = 'Active'
       ORDER BY created_at ASC
       LIMIT 1`,
    );

    const row = result.rows[0];
    if (!row) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", "No active campaign is configured.");
    }

    return {
      campaignId: row.campaign_id,
      marketId: row.market_id,
      name: row.name,
      status: row.status,
    };
  }
}
