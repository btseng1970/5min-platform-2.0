// QR domain service. Reads and writes only qr.* — the schema this package
// owns. No constructor parameter properties (see
// packages/shared/money/src/index.ts for why that matters at runtime).
//
// Storage model: qr.code stores only a code_hash. The raw signed QR value is
// never persisted and never logged — it exists only transiently in the
// request, hashed through the injected QrCodeVerifier before it ever reaches
// SQL. HmacQrCodeVerifier itself never reads process.env directly (the
// caller supplies the secret via typed config); only apps/api's factory
// wiring is permitted to read the environment.
//
// One-time-use is enforced atomically by SELECT ... FOR UPDATE on the target
// qr.code row inside one transaction: a concurrent scan of the same code
// blocks on that row lock, so only one caller can ever observe
// status = 'Unused' and win the claim. The database row is the sole
// enforcement point — never scan_event, cache, or in-memory state.
//
// Scan idempotency is keyed by (client_request_id, request_fingerprint):
// an exact retry (same client_request_id, same fingerprint) replays the
// original recorded outcome — success or failure — without reprocessing.
// The same client_request_id reused with a different fingerprint is
// rejected as IDEMPOTENCY_CONFLICT before anything is touched. The
// idempotency check re-runs a second time after the row lock is acquired,
// closing the race window against a concurrent identical retry that commits
// while this caller was blocked waiting for the lock.
//
// Failed claims (ALREADY_USED, INACTIVE) never mutate qr.code — the
// attempt transaction has nothing to commit — and their scan_event audit
// row is written in a separate, independent statement after that
// transaction has settled, so a failure-record write problem can never be
// confused with (or roll back) a real state change.

import type { Pool, PoolClient } from "pg";
import { createHmac, randomUUID } from "node:crypto";
import { CanonicalApiError, type CanonicalErrorCode } from "errors";
import { withTransaction, writeOutboxEvent } from "@5min/shared-db";

export interface QrCodeVerifier {
  hash(rawValue: string): string;
}

/**
 * Prototype-only demo verifier. The secret is supplied by the caller (typed
 * config), never read from process.env by this class itself.
 */
export class HmacQrCodeVerifier implements QrCodeVerifier {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  hash(rawValue: string): string {
    return createHmac("sha256", this.secret).update(rawValue).digest("hex");
  }
}

/**
 * Deterministic fallback secret for local/demo use only when the caller
 * does not supply one via typed config. Never used for production data.
 */
export const PROTOTYPE_QR_SIGNING_SECRET_FALLBACK = "prototype-demo-qr-signing-secret-not-for-production";

export interface QrScanInput {
  rawCode: string;
  memberId: string;
  clientRequestId: string;
  correlationId: string;
}

export interface QrScanResult {
  qrCodeId: string;
  state: "USED";
}

type ScanResultCode = "SUCCESS" | "ALREADY_USED" | "INACTIVE";

type PersistedOutcome =
  | { ok: true; resultCode: "SUCCESS"; result: QrScanResult }
  | { ok: false; resultCode: Exclude<ScanResultCode, "SUCCESS">; errorCode: CanonicalErrorCode; message: string };

type ScanAttemptOutcome =
  | { kind: "success"; result: QrScanResult }
  | { kind: "replay"; outcome: PersistedOutcome }
  | { kind: "notFound" }
  | { kind: "freshFailure"; failure: Extract<PersistedOutcome, { ok: false }>; qrCodeId: string };

interface QrCodeRow {
  qr_code_id: string;
  campaign_id: string;
  status: "Unused" | "Used" | "Inactive";
}

interface Queryable {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}

function buildFailureOutcome(status: "Used" | "Inactive"): Extract<PersistedOutcome, { ok: false }> {
  if (status === "Inactive") {
    return {
      ok: false,
      resultCode: "INACTIVE",
      errorCode: "STATE_CONFLICT",
      message: "This QR code has been deactivated.",
    };
  }
  return {
    ok: false,
    resultCode: "ALREADY_USED",
    errorCode: "STATE_CONFLICT",
    message: "This QR code has already been used.",
  };
}

function toApiError(outcome: Extract<PersistedOutcome, { ok: false }>): CanonicalApiError {
  return new CanonicalApiError(outcome.errorCode, outcome.message, { details: { reason: outcome.resultCode } });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

export class QrService {
  private readonly pool: Pool;
  private readonly verifier: QrCodeVerifier;

  constructor(pool: Pool, verifier: QrCodeVerifier) {
    this.pool = pool;
    this.verifier = verifier;
  }

  async scan(input: QrScanInput): Promise<QrScanResult> {
    const fingerprint = this.verifier.hash(input.rawCode);

    const precheck = await this.checkIdempotency(this.pool, input.clientRequestId, fingerprint);
    if (precheck) {
      return this.resolveReplay(precheck);
    }

    const attempt = await withTransaction(this.pool, (client) => this.attemptClaim(client, input, fingerprint));

    if (attempt.kind === "success") {
      return attempt.result;
    }
    if (attempt.kind === "replay") {
      return this.resolveReplay(attempt.outcome);
    }
    if (attempt.kind === "notFound") {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", "The scanned QR code does not exist.");
    }

    await this.recordFailure(input, fingerprint, attempt.failure, attempt.qrCodeId);
    throw toApiError(attempt.failure);
  }

  private resolveReplay(outcome: PersistedOutcome): QrScanResult {
    if (outcome.ok) {
      return outcome.result;
    }
    throw toApiError(outcome);
  }

  private async checkIdempotency(
    queryable: Queryable,
    clientRequestId: string,
    fingerprint: string,
  ): Promise<PersistedOutcome | undefined> {
    const result = await queryable.query<{ request_fingerprint: string; outcome_json: PersistedOutcome }>(
      `SELECT request_fingerprint, outcome_json FROM qr.scan_event WHERE client_request_id = $1`,
      [clientRequestId],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    if (row.request_fingerprint !== fingerprint) {
      throw new CanonicalApiError(
        "IDEMPOTENCY_CONFLICT",
        `client_request_id ${clientRequestId} was already used with a different request.`,
      );
    }
    return row.outcome_json;
  }

  private async attemptClaim(
    client: PoolClient,
    input: QrScanInput,
    fingerprint: string,
  ): Promise<ScanAttemptOutcome> {
    const codeResult = await client.query<QrCodeRow>(
      `SELECT qr_code_id, campaign_id, status FROM qr.code WHERE code_hash = $1 FOR UPDATE`,
      [fingerprint],
    );
    const codeRow = codeResult.rows[0];
    if (!codeRow) {
      return { kind: "notFound" };
    }

    const replay = await this.checkIdempotency(client, input.clientRequestId, fingerprint);
    if (replay) {
      return { kind: "replay", outcome: replay };
    }

    if (codeRow.status !== "Unused") {
      return { kind: "freshFailure", failure: buildFailureOutcome(codeRow.status), qrCodeId: codeRow.qr_code_id };
    }

    await client.query(
      `UPDATE qr.code SET status = 'Used', used_by_member_id = $2, used_at = now() WHERE qr_code_id = $1`,
      [codeRow.qr_code_id, input.memberId],
    );

    const result: QrScanResult = { qrCodeId: codeRow.qr_code_id, state: "USED" };
    const outcome: PersistedOutcome = { ok: true, resultCode: "SUCCESS", result };

    try {
      await client.query(
        `INSERT INTO qr.scan_event
           (scan_event_id, qr_code_id, member_id, client_request_id, request_fingerprint,
            correlation_id, outcome_json, result_code, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())`,
        [
          randomUUID(),
          codeRow.qr_code_id,
          input.memberId,
          input.clientRequestId,
          fingerprint,
          input.correlationId,
          JSON.stringify(outcome),
          outcome.resultCode,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new CanonicalApiError(
          "IDEMPOTENCY_CONFLICT",
          `client_request_id ${input.clientRequestId} was already used with a different request.`,
        );
      }
      throw error;
    }

    await writeOutboxEvent(client, {
      eventId: randomUUID(),
      eventType: "QRCodeScanned",
      aggregateType: "qr_code",
      aggregateId: codeRow.qr_code_id,
      aggregateVersion: 1,
      payload: {
        qr_code_id: codeRow.qr_code_id,
        campaign_id: codeRow.campaign_id,
        member_id: input.memberId,
        correlation_id: input.correlationId,
        occurred_at: new Date().toISOString(),
      },
      correlationId: input.correlationId,
    });

    return { kind: "success", result };
  }

  private async recordFailure(
    input: QrScanInput,
    fingerprint: string,
    failure: Extract<PersistedOutcome, { ok: false }>,
    qrCodeId: string,
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO qr.scan_event
           (scan_event_id, qr_code_id, member_id, client_request_id, request_fingerprint,
            correlation_id, outcome_json, result_code, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (client_request_id) DO NOTHING`,
        [
          randomUUID(),
          qrCodeId,
          input.memberId,
          input.clientRequestId,
          fingerprint,
          input.correlationId,
          JSON.stringify(failure),
          failure.resultCode,
        ],
      );
    } catch (error) {
      console.error(
        `[qr] failed to record failure scan_event: client_request_id=${input.clientRequestId} correlation_id=${input.correlationId} reason=${failure.resultCode}: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}
