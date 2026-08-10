import { Global, Module } from "@nestjs/common";
import type { Pool } from "pg";
import { MemberService } from "@5min/domain-crm";
import { DemoMemberContextProvider } from "./demo-member-context.provider";
import { PG_POOL } from "../db/db.module";
import { MEMBER_SERVICE } from "./members.tokens";

@Global()
@Module({
  providers: [
    DemoMemberContextProvider,
    {
      provide: MEMBER_SERVICE,
      useFactory: (pool: Pool): MemberService => new MemberService(pool),
      inject: [PG_POOL],
    },
  ],
  exports: [DemoMemberContextProvider, MEMBER_SERVICE],
})
export class MembersModule {}
