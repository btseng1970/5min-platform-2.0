import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { InternalDemoAdminContext } from "./internal-demo-admin-context";

@Module({
  controllers: [AdminController],
  providers: [InternalDemoAdminContext],
})
export class AdminModule {}
