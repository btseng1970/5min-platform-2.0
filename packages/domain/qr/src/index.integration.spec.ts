// Real-PostgreSQL integration test — proves the atomic one-time-use claim
// under genuine concurrent connections, which a fake Pool cannot exercise
// (row-level locking is a real database behavior, not something a mock can
// simulate). Skipped when DATABASE_URL is not set (e.g. a machine without
// the local dev Postgres running); every other assertion in this package
// runs against a fake Pool and always executes.

import pg from "pg";
import { randomUUID } from "node:crypto";
import { HmacQrCodeVerifier, QrService } from "./index";

const { Pool } = pg;

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip;

describeIfDb("QrService.scan — real Postgres concurrency", () => {
  const verifier = new HmacQrCodeVerifier("integration-test-secret");
  let pool: InstanceType<typeof Pool>;

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("lets exactly one of two concurrent scans of the same code succeed", async () => {
    const qrCodeId = `integration_test_${randomUUID()}`;
    const rawCode = `INTEGRATION-TEST-RAW-${randomUUID()}`;
    const codeHash = verifier.hash(rawCode);

    await pool.query(
      `INSERT INTO qr.code (qr_code_id, code_hash, campaign_id, status) VALUES ($1, $2, 'integration_test_campaign', 'Unused')`,
      [qrCodeId, codeHash],
    );

    try {
      const serviceA = new QrService(pool, verifier);
      const serviceB = new QrService(pool, verifier);

      const [outcomeA, outcomeB] = await Promise.allSettled([
        serviceA.scan({
          rawCode,
          memberId: "integration_test_member_a",
          clientRequestId: `req-a-${randomUUID()}`,
          correlationId: "integration-corr-a",
        }),
        serviceB.scan({
          rawCode,
          memberId: "integration_test_member_b",
          clientRequestId: `req-b-${randomUUID()}`,
          correlationId: "integration-corr-b",
        }),
      ]);

      const fulfilled = [outcomeA, outcomeB].filter((o) => o.status === "fulfilled");
      const rejected = [outcomeA, outcomeB].filter((o) => o.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ errorCode: "STATE_CONFLICT" });

      const codeRow = await pool.query(`SELECT status, used_by_member_id FROM qr.code WHERE qr_code_id = $1`, [qrCodeId]);
      expect(codeRow.rows[0].status).toBe("Used");

      const scanEventRows = await pool.query(
        `SELECT result_code FROM qr.scan_event WHERE qr_code_id = $1 ORDER BY created_at`,
        [qrCodeId],
      );
      const resultCodes = scanEventRows.rows.map((row: { result_code: string }) => row.result_code).sort();
      expect(resultCodes).toEqual(["ALREADY_USED", "SUCCESS"]);

      const outboxRows = await pool.query(
        `SELECT event_type FROM platform.event_outbox WHERE aggregate_id = $1 AND event_type = 'QRCodeScanned'`,
        [qrCodeId],
      );
      expect(outboxRows.rows).toHaveLength(1);
    } finally {
      await pool.query(`DELETE FROM qr.scan_event WHERE qr_code_id = $1`, [qrCodeId]);
      await pool.query(`DELETE FROM platform.event_outbox WHERE aggregate_id = $1`, [qrCodeId]);
      await pool.query(`DELETE FROM qr.code WHERE qr_code_id = $1`, [qrCodeId]);
    }
  });
});
