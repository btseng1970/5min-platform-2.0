import { Module } from "@nestjs/common";
import { MemberCenterController } from "./member-center.controller";
import { WalletModule } from "../wallet/wallet.module";
import { CollectionModule } from "../collection/collection.module";
import { CampaignsModule } from "../campaigns/campaigns.module";

@Module({
  imports: [WalletModule, CollectionModule, CampaignsModule],
  controllers: [MemberCenterController],
})
export class MemberCenterModule {}
