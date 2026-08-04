// CRM domain service. Reads only crm.* — the schema this package owns. No
// constructor parameter properties (see packages/shared/money/src/index.ts
// for why that matters at runtime).

import type { Pool } from "pg";
import { CanonicalApiError } from "errors";

export interface MemberSummary {
  memberId: string;
  displayName: string;
}

export class MemberService {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getById(memberId: string): Promise<MemberSummary> {
    const result = await this.pool.query<{ member_id: string; display_name: string }>(
      `SELECT member_id, display_name
       FROM crm.member
       WHERE member_id = $1`,
      [memberId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", `Member ${memberId} does not exist.`);
    }

    return {
      memberId: row.member_id,
      displayName: row.display_name,
    };
  }
}
