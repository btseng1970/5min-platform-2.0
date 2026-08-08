import { Module } from "@nestjs/common";
import type { Pool } from "pg";
import { WalletService } from "@5min/domain-wallet";
import { WalletController } from "./wallet.controller";
import { PG_POOL } from "../db/db.module";
import { WALLET_SERVICE } from "./wallet.tokens";

@Module({
  controllers: [WalletController],
  providers: [
    {
      provide: WALLET_SERVICE,
      useFactory: (pool: Pool): WalletService => new WalletService(pool),
      inject: [PG_POOL],
    },
  ],
  exports: [WALLET_SERVICE],
})
export class WalletModule {}
