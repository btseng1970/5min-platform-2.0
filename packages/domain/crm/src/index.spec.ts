import type { Pool } from "pg";
import { CanonicalApiError } from "errors";
import { MemberService } from "./index";

function fakePool(rows: unknown[]): Pool {
  return {
    query: jest.fn().mockResolvedValue({ rows }),
  } as unknown as Pool;
}

describe("MemberService.getById", () => {
  it("returns the member summary", async () => {
    const pool = fakePool([{ member_id: "demo_member_tw_001", display_name: "Demo Member (TW)" }]);
    const service = new MemberService(pool);

    const result = await service.getById("demo_member_tw_001");

    expect(result).toEqual({
      memberId: "demo_member_tw_001",
      displayName: "Demo Member (TW)",
    });
  });

  it("throws RESOURCE_NOT_FOUND when the member does not exist", async () => {
    const pool = fakePool([]);
    const service = new MemberService(pool);

    await expect(service.getById("nonexistent")).rejects.toThrow(CanonicalApiError);
    await expect(service.getById("nonexistent")).rejects.toMatchObject({ errorCode: "RESOURCE_NOT_FOUND" });
  });
});
