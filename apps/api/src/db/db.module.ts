import { Global, Module } from "@nestjs/common";
import type { Pool } from "pg";
import { createPool } from "@5min/shared-db";

export const PG_POOL = Symbol("PG_POOL");

/**
 * The Pool is constructed eagerly (cheap — pg's Pool does not connect until
 * a query is issued), but DATABASE_URL is not validated here. A route that
 * never queries the database (e.g. /healthz) must be able to boot without
 * one configured; a route that does query it will fail naturally, with a
 * real connection error, only when it actually tries.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => createPool(process.env.DATABASE_URL ?? ""),
    },
  ],
  exports: [PG_POOL],
})
export class DbModule {}
