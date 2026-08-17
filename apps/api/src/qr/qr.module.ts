import { Module } from "@nestjs/common";
import type { Pool } from "pg";
import { HmacQrCodeVerifier, PROTOTYPE_QR_SIGNING_SECRET_FALLBACK, QrService } from "@5min/domain-qr";
import { QrController } from "./qr.controller";
import { PG_POOL } from "../db/db.module";
import { QR_SERVICE } from "./qr.tokens";

@Module({
  controllers: [QrController],
  providers: [
    {
      provide: QR_SERVICE,
      useFactory: (pool: Pool): QrService =>
        new QrService(pool, new HmacQrCodeVerifier(process.env.QR_SIGNING_SECRET ?? PROTOTYPE_QR_SIGNING_SECRET_FALLBACK)),
      inject: [PG_POOL],
    },
  ],
})
export class QrModule {}
