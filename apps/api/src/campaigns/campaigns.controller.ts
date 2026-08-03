import { Controller, Get, Inject } from "@nestjs/common";
import { CampaignService, type CampaignSummary } from "@5min/domain-campaign";
import { CAMPAIGN_SERVICE } from "./campaigns.tokens";

@Controller("campaigns")
export class CampaignsController {
  constructor(@Inject(CAMPAIGN_SERVICE) private readonly campaignService: CampaignService) {}

  @Get("current")
  async getCurrent(): Promise<CampaignSummary> {
    return this.campaignService.getCurrent();
  }
}
