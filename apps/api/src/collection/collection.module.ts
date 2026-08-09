import { Module } from "@nestjs/common";
import type { Pool } from "pg";
import { CollectionService } from "@5min/domain-ip-asset";
import { PG_POOL } from "../db/db.module";
import { COLLECTION_SERVICE } from "./collection.tokens";

// No controller here by design: there is no standalone GET /api/v1/collection
// route (per the binding read-composition rule). This module exists only to
// provide CollectionService for other modules to compose — the unlock write
// path (RewardController, PROTO-001F) today, and the GET /api/v1/me read
// composition (PROTO-001G) next.
@Module({
  providers: [
    {
      provide: COLLECTION_SERVICE,
      useFactory: (pool: Pool): CollectionService => new CollectionService(pool),
      inject: [PG_POOL],
    },
  ],
  exports: [COLLECTION_SERVICE],
})
export class CollectionModule {}
