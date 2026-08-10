import { Module } from "@nestjs/common";
import type { Pool } from "pg";
import { CampaignService } from "@5min/domain-campaign";
import { CampaignsController } from "./campaigns.controller";
import { PG_POOL } from "../db/db.module";
import { CAMPAIGN_SERVICE } from "./campaigns.tokens";

@Module({
  controllers: [CampaignsController],
  providers: [
    {
      provide: CAMPAIGN_SERVICE,
      useFactory: (pool: Pool): CampaignService => new CampaignService(pool),
      inject: [PG_POOL],
    },
  ],
  exports: [CAMPAIGN_SERVICE],
})
export class CampaignsModule {}
