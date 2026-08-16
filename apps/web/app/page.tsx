import { JourneyPanel } from "./journey-panel";
import { createApiClient, type CampaignSummary } from "api-contract";

// Consumes the BFF only through packages/shared/api-contract's typed
// client (GA-015) — never a hand-rolled fetch()/interface pair. That
// duplication was exactly what let this page silently render
// "Market: " (blank) for several commits after PROTO-001C's controller
// response shape changed to snake_case (fixed in 87e29ae).
async function getCurrentCampaign(): Promise<CampaignSummary | null> {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
  const client = createApiClient(apiBaseUrl);
  const result = await client.getCurrentCampaign();
  return result.ok ? result.body : null;
}

export default async function Page() {
  const campaign = await getCurrentCampaign();

  if (!campaign) {
    return <p>No active campaign is configured.</p>;
  }

  return (
    <main>
      <h1>{campaign.name}</h1>
      <p>Market: {campaign.market_id}</p>
      <p>Status: {campaign.status}</p>
      <JourneyPanel campaignId={campaign.campaign_id} />
    </main>
  );
}
