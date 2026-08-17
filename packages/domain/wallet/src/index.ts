// Wallet domain service. Reads and writes only wallet.* — the schema this
// package owns. No constructor parameter properties (see
// packages/shared/money/src/index.ts for why that matters at runtime).
//
// Append-only: wallet.ledger_entry only ever receives INSERTs (enforced at
// the database permission level too — app_rw_user has no UPDATE or DELETE
// grant on this table). Available points is always derived by folding every
// row for a member, never a separately-maintained mutable balance column,
// so there is no "balance" value that could drift from the ledger.
//
// Integer-only: every amount is validated through Points (packages/shared/
// money) — a safe non-negative integer — both when posting a new entry and
// when folding existing rows into a summary. No float/double anywhere.
//
// Idempotent posting: UNIQUE(source_type, source_id) means posting the same
// source (e.g. the same draw_id) twice is a no-op — a caller retry after a
// draw's outcome is already posted never double-credits the member.

import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { Points } from "money";

export interface WalletSummary {
  availablePoints: number;
}

export interface PostDrawPointsInput {
  memberId: string;
  drawId: string;
  amount: number;
  correlationId: string;
}

export class WalletService {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async getSummary(memberId: string): Promise<WalletSummary> {
    const result = await this.pool.query<{ amount: number }>(
      `SELECT amount FROM wallet.ledger_entry WHERE member_id = $1`,
      [memberId],
    );
    const total = result.rows.reduce((points, row) => points.add(Points.of(row.amount)), Points.zero());
    return { availablePoints: total.toMinorUnits() };
  }

  async postDrawPoints(input: PostDrawPointsInput): Promise<void> {
    const amount = Points.of(input.amount).toMinorUnits();
    await this.pool.query(
      `INSERT INTO wallet.ledger_entry (ledger_entry_id, member_id, amount, source_type, source_id, correlation_id, created_at)
       VALUES ($1, $2, $3, 'DRAW_POINT', $4, $5, now())
       ON CONFLICT (source_type, source_id) DO NOTHING`,
      [randomUUID(), input.memberId, amount, input.drawId, input.correlationId],
    );
  }
}
