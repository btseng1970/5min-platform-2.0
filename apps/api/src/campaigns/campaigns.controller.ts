import { Controller, Get, Inject } from "@nestjs/common";
import { CampaignService } from "@5min/domain-campaign";
import { CanonicalApiError } from "errors";
import type { FlagProvider } from "@5min/shared-flags";
import { FLAG_PROVIDER } from "../flags/flags.module";
import { CAMPAIGN_SERVICE } from "./campaigns.tokens";

interface CampaignSummaryResponseBody {
  campaign_id: string;
  market_id: string;
  name: string;
  status: string;
}

@Controller("campaigns")
export class CampaignsController {
  constructor(
    @Inject(CAMPAIGN_SERVICE) private readonly campaignService: CampaignService,
    @Inject(FLAG_PROVIDER) private readonly flags: FlagProvider,
  ) {}

  @Get("current")
  async getCurrent(): Promise<CampaignSummaryResponseBody> {
    if (!this.flags.isEnabled("proto_campaign_shell")) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", "No active campaign is configured.");
    }
    const campaign = await this.campaignService.getCurrent();
    return {
      campaign_id: campaign.campaignId,
      market_id: campaign.marketId,
      name: campaign.name,
      status: campaign.status,
    };
  }
}
