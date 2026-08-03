interface CampaignSummary {
  campaignId: string;
  marketId: string;
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
      <p>Market: {campaign.marketId}</p>
      <p>Status: {campaign.status}</p>
    </main>
  );
}
