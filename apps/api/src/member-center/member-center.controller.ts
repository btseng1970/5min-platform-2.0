import { Controller, Get, Inject } from "@nestjs/common";
import { MemberService } from "@5min/domain-crm";
import { WalletService } from "@5min/domain-wallet";
import { CollectionService } from "@5min/domain-ip-asset";
import { CampaignService } from "@5min/domain-campaign";
import { CanonicalApiError } from "errors";
import type { FlagProvider } from "@5min/shared-flags";
import { FLAG_PROVIDER } from "../flags/flags.module";
import { DemoMemberContextProvider } from "../members/demo-member-context.provider";
import { MEMBER_SERVICE } from "../members/members.tokens";
import { WALLET_SERVICE } from "../wallet/wallet.tokens";
import { COLLECTION_SERVICE } from "../collection/collection.tokens";
import { CAMPAIGN_SERVICE } from "../campaigns/campaigns.tokens";

interface MemberCenterResponseBody {
  member_id: string;
  display_name: string;
  wallet_summary: {
    available_points: number;
  };
  collection: Array<{ item_id: string; unlocked: boolean }>;
}

@Controller("me")
export class MemberCenterController {
  constructor(
    @Inject(MEMBER_SERVICE) private readonly memberService: MemberService,
    @Inject(WALLET_SERVICE) private readonly walletService: WalletService,
    @Inject(COLLECTION_SERVICE) private readonly collectionService: CollectionService,
    @Inject(CAMPAIGN_SERVICE) private readonly campaignService: CampaignService,
    @Inject(FLAG_PROVIDER) private readonly flags: FlagProvider,
    private readonly memberContext: DemoMemberContextProvider,
  ) {}

  @Get()
  async getSummary(): Promise<MemberCenterResponseBody> {
    if (!this.flags.isEnabled("proto_member_center")) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", "Member center is not enabled.");
    }

    const memberId = this.memberContext.resolveMemberId();

    // Read composition only — each call hits exactly one domain service's
    // own public API, which touches only the schema that service owns. No
    // caller-side cross-schema SQL, per the binding read-composition rule.
    const [member, wallet, campaign] = await Promise.all([
      this.memberService.getById(memberId),
      this.walletService.getSummary(memberId),
      this.campaignService.getCurrent(),
    ]);
    const collection = await this.collectionService.getCollection(memberId, campaign.campaignId);

    return {
      member_id: member.memberId,
      display_name: member.displayName,
      wallet_summary: { available_points: wallet.availablePoints },
      collection: collection.map((entry) => ({ item_id: entry.itemId, unlocked: entry.unlocked })),
    };
  }
}
