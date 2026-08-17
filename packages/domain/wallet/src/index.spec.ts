import type { Pool } from "pg";
import { WalletService } from "./index";

interface FakeLedgerEntry {
  member_id: string;
  amount: number;
  source_type: string;
  source_id: string;
}

interface FakeState {
  entries: FakeLedgerEntry[];
}

function fakePool(state: FakeState): Pool {
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    const text = sql.trim();

    if (text.startsWith("SELECT amount FROM wallet.ledger_entry")) {
      const memberId = params[0] as string;
      return { rows: state.entries.filter((e) => e.member_id === memberId).map((e) => ({ amount: e.amount })) };
    }

    if (text.startsWith("INSERT INTO wallet.ledger_entry")) {
      const [, memberId, amount, sourceId] = params as [string, string, number, string, string];
      const exists = state.entries.some((e) => e.source_type === "DRAW_POINT" && e.source_id === sourceId);
      if (!exists) {
        state.entries.push({ member_id: memberId, amount, source_type: "DRAW_POINT", source_id: sourceId });
      }
      return { rows: [] };
    }

    throw new Error(`Unexpected query in test: ${text}`);
  });

  return { query } as unknown as Pool;
}

const MEMBER_ID = "demo_member_tw_001";

describe("WalletService", () => {
  it("sums multiple ledger entries into the available points total", async () => {
    const state: FakeState = {
      entries: [
        { member_id: MEMBER_ID, amount: 100, source_type: "DRAW_POINT", source_id: "draw-1" },
        { member_id: MEMBER_ID, amount: 100, source_type: "DRAW_POINT", source_id: "draw-2" },
      ],
    };
    const service = new WalletService(fakePool(state));

    const summary = await service.getSummary(MEMBER_ID);

    expect(summary).toEqual({ availablePoints: 200 });
  });

  it("returns zero for a member with no ledger entries", async () => {
    const service = new WalletService(fakePool({ entries: [] }));

    const summary = await service.getSummary(MEMBER_ID);

    expect(summary).toEqual({ availablePoints: 0 });
  });

  it("posts a draw's points and reflects them in the summary", async () => {
    const state: FakeState = { entries: [] };
    const service = new WalletService(fakePool(state));

    await service.postDrawPoints({ memberId: MEMBER_ID, drawId: "draw-1", amount: 100, correlationId: "corr-1" });
    const summary = await service.getSummary(MEMBER_ID);

    expect(summary).toEqual({ availablePoints: 100 });
  });

  it("is idempotent per draw_id — posting the same draw twice never double-credits", async () => {
    const state: FakeState = { entries: [] };
    const service = new WalletService(fakePool(state));

    await service.postDrawPoints({ memberId: MEMBER_ID, drawId: "draw-1", amount: 100, correlationId: "corr-1" });
    await service.postDrawPoints({ memberId: MEMBER_ID, drawId: "draw-1", amount: 100, correlationId: "corr-1-retry" });
    const summary = await service.getSummary(MEMBER_ID);

    expect(summary).toEqual({ availablePoints: 100 });
    expect(state.entries).toHaveLength(1);
  });

  it("rejects a negative amount before writing anything", async () => {
    const state: FakeState = { entries: [] };
    const service = new WalletService(fakePool(state));

    await expect(
      service.postDrawPoints({ memberId: MEMBER_ID, drawId: "draw-1", amount: -1, correlationId: "corr-1" }),
    ).rejects.toThrow(RangeError);
    expect(state.entries).toHaveLength(0);
  });
});
