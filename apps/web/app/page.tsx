import { JourneyPanel } from "./journey-panel";

// Matches apps/api's actual wire contract (docs/openapi/openapi.yaml's
// CampaignSummary schema) — snake_case, not camelCase. A prior version of
// this file used camelCase field names left over from before PROTO-001C's
// forward-fix corrected the controller's response shape to match the
// documented contract; that mismatch silently rendered "Market: undefined"
// since fetch().json() returns `any` and TypeScript could not catch it.
interface CampaignSummary {
  campaign_id: string;
  market_id: string;
  name: string;
  status: string;
}

async function getCurrentCampaign(): Promise<CampaignSummary | null> {
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3000";
  const response = await fetch(`${apiBaseUrl}/api/v1/campaigns/current`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }
  return response.json();
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
