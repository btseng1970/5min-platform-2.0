import { Global, Module } from "@nestjs/common";
import { DemoMemberContextProvider } from "./demo-member-context.provider";

@Global()
@Module({
  providers: [DemoMemberContextProvider],
  exports: [DemoMemberContextProvider],
})
export class MembersModule {}
