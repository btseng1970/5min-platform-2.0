import type { Pool } from "pg";
import { CollectionService } from "./index";

interface FakeCollectionItem {
  item_id: string;
  campaign_id: string;
  linked_prize_tier_id: string | null;
}

interface FakeUnlock {
  member_id: string;
  item_id: string;
}

interface FakeState {
  items: FakeCollectionItem[];
  unlocks: FakeUnlock[];
}

function fakePool(state: FakeState): Pool {
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    const text = sql.trim();

    if (text.startsWith("SELECT ci.item_id, (mu.unlock_id IS NOT NULL)")) {
      const [memberId, campaignId] = params as [string, string];
      const rows = state.items
        .filter((item) => item.campaign_id === campaignId)
        .map((item) => ({
          item_id: item.item_id,
          unlocked: state.unlocks.some((u) => u.member_id === memberId && u.item_id === item.item_id),
        }));
      return { rows };
    }

    if (text.startsWith("SELECT item_id FROM ip_asset.collection_item WHERE linked_prize_tier_id")) {
      const tierId = params[0] as string;
      const item = state.items.find((i) => i.linked_prize_tier_id === tierId);
      return { rows: item ? [{ item_id: item.item_id }] : [] };
    }

    if (text.startsWith("INSERT INTO ip_asset.member_unlock")) {
      const [, memberId, itemId] = params as [string, string, string];
      const exists = state.unlocks.some((u) => u.member_id === memberId && u.item_id === itemId);
      if (!exists) {
        state.unlocks.push({ member_id: memberId, item_id: itemId });
      }
      return { rows: [] };
    }

    throw new Error(`Unexpected query in test: ${text}`);
  });

  return { query } as unknown as Pool;
}

const MEMBER_ID = "demo_member_tw_001";
const CAMPAIGN_ID = "demo_campaign_tw_001";

function newState(items: FakeCollectionItem[]): FakeState {
  return { items, unlocks: [] };
}

describe("CollectionService", () => {
  it("lists all campaign items with unlocked=false when nothing is unlocked yet", async () => {
    const state = newState([
      { item_id: "item-gold", campaign_id: CAMPAIGN_ID, linked_prize_tier_id: "demo_tier_gold" },
      { item_id: "item-silver", campaign_id: CAMPAIGN_ID, linked_prize_tier_id: "demo_tier_silver" },
    ]);
    const service = new CollectionService(fakePool(state));

    const collection = await service.getCollection(MEMBER_ID, CAMPAIGN_ID);

    expect(collection).toEqual([
      { itemId: "item-gold", unlocked: false },
      { itemId: "item-silver", unlocked: false },
    ]);
  });

  it("unlocks the item linked to a won prize tier and reflects it in the collection", async () => {
    const state = newState([
      { item_id: "item-gold", campaign_id: CAMPAIGN_ID, linked_prize_tier_id: "demo_tier_gold" },
      { item_id: "item-silver", campaign_id: CAMPAIGN_ID, linked_prize_tier_id: "demo_tier_silver" },
    ]);
    const service = new CollectionService(fakePool(state));

    await service.unlockFromPrizeDraw({ memberId: MEMBER_ID, prizeTierId: "demo_tier_gold", drawId: "draw-1", correlationId: "corr-1" });
    const collection = await service.getCollection(MEMBER_ID, CAMPAIGN_ID);

    expect(collection).toEqual([
      { itemId: "item-gold", unlocked: true },
      { itemId: "item-silver", unlocked: false },
    ]);
  });

  it("is idempotent per (member_id, item_id) — winning the same tier twice never duplicates the unlock", async () => {
    const state = newState([{ item_id: "item-gold", campaign_id: CAMPAIGN_ID, linked_prize_tier_id: "demo_tier_gold" }]);
    const service = new CollectionService(fakePool(state));

    await service.unlockFromPrizeDraw({ memberId: MEMBER_ID, prizeTierId: "demo_tier_gold", drawId: "draw-1", correlationId: "corr-1" });
    await service.unlockFromPrizeDraw({ memberId: MEMBER_ID, prizeTierId: "demo_tier_gold", drawId: "draw-2", correlationId: "corr-2" });

    expect(state.unlocks).toHaveLength(1);
  });

  it("does nothing when no collection item is linked to the won tier", async () => {
    const state = newState([{ item_id: "item-gold", campaign_id: CAMPAIGN_ID, linked_prize_tier_id: "demo_tier_gold" }]);
    const service = new CollectionService(fakePool(state));

    await service.unlockFromPrizeDraw({ memberId: MEMBER_ID, prizeTierId: "demo_tier_unlinked", drawId: "draw-1", correlationId: "corr-1" });

    expect(state.unlocks).toHaveLength(0);
  });
});
