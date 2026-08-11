// Thin PostgreSQL access layer shared by domain repositories. Owns nothing
// about business logic; only connection pooling, transaction wrapping, and
// the transactional-outbox write helper (FND-005 minimum subset).

import { Pool, type PoolClient } from "pg";

export function createPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}

/**
 * Runs fn inside a single BEGIN/COMMIT transaction on one checked-out client.
 * Any thrown error triggers ROLLBACK before the error propagates. This is
 * the sole mechanism by which a domain write and its outbox row share one
 * atomic transaction.
 */
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface OutboxEventInput {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  payload: Record<string, unknown>;
  correlationId: string;
  causationId?: string;
}

/**
 * Inserts one row into platform.event_outbox using the same client/
 * transaction as the domain write it accompanies (Cross-schema Write Ban's
 * sole exception, TDS line 1113/1021). Must always be called inside the same
 * withTransaction() block as the domain write.
 */
export async function writeOutboxEvent(
  client: PoolClient,
  event: OutboxEventInput,
): Promise<void> {
  await client.query(
    `INSERT INTO platform.event_outbox
       (event_id, event_type, aggregate_type, aggregate_id, aggregate_version,
        payload_json, status, correlation_id, causation_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8, now())`,
    [
      event.eventId,
      event.eventType,
      event.aggregateType,
      event.aggregateId,
      event.aggregateVersion,
      JSON.stringify(event.payload),
      event.correlationId,
      event.causationId ?? null,
    ],
  );
}

export interface OutboxEventRecord {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  status: string;
  correlationId: string;
  causationId: string | null;
  createdAt: Date;
  publishedAt: Date | null;
}

/**
 * Reads platform.event_outbox by correlation_id — the read side of the
 * PROTO-001H internal admin correlation trace. platform.event_outbox is
 * cross-cutting platform infrastructure, not any single bounded context's
 * owned table (the same rationale that makes writing to it the Cross-schema
 * Write Ban's sole exception), so reading it here does not cross a domain
 * boundary the way reading another context's own tables would.
 */
export async function queryOutboxEventsByCorrelationId(
  pool: Pool,
  correlationId: string,
): Promise<OutboxEventRecord[]> {
  const result = await pool.query<{
    event_id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    status: string;
    correlation_id: string;
    causation_id: string | null;
    created_at: Date;
    published_at: Date | null;
  }>(
    `SELECT event_id, event_type, aggregate_type, aggregate_id, status,
            correlation_id, causation_id, created_at, published_at
     FROM platform.event_outbox
     WHERE correlation_id = $1
     ORDER BY created_at ASC`,
    [correlationId],
  );
  return result.rows.map((row) => ({
    eventId: row.event_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    status: row.status,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  }));
}
