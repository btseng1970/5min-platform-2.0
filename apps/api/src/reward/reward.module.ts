import { Module } from "@nestjs/common";
import type { Pool } from "pg";
import { DrawService } from "@5min/domain-reward";
import { RewardController } from "./reward.controller";
import { PG_POOL } from "../db/db.module";
import { DRAW_SERVICE } from "./reward.tokens";

@Module({
  controllers: [RewardController],
  providers: [
    {
      provide: DRAW_SERVICE,
      useFactory: (pool: Pool): DrawService => new DrawService(pool),
      inject: [PG_POOL],
    },
  ],
})
export class RewardModule {}
