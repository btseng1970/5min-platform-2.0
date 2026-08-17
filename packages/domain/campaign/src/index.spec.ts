import type { Pool } from "pg";
import { CanonicalApiError } from "errors";
import { CampaignService } from "./index";

function fakePool(rows: unknown[]): Pool {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as Pool;
}

describe("CampaignService.getCurrent", () => {
  it("returns the active campaign summary", async () => {
    const pool = fakePool([
      {
        campaign_id: "demo_campaign_tw_001",
        market_id: "TW",
        name: "5min Coffee Demo Campaign (TW)",
        status: "Active",
      },
    ]);
    const service = new CampaignService(pool);

    const result = await service.getCurrent();

    expect(result).toEqual({
      campaignId: "demo_campaign_tw_001",
      marketId: "TW",
      name: "5min Coffee Demo Campaign (TW)",
      status: "Active",
    });
  });

  it("throws RESOURCE_NOT_FOUND when no active campaign exists", async () => {
    const pool = fakePool([]);
    const service = new CampaignService(pool);

    await expect(service.getCurrent()).rejects.toThrow(CanonicalApiError);
    await expect(service.getCurrent()).rejects.toMatchObject({ errorCode: "RESOURCE_NOT_FOUND" });
  });
});
