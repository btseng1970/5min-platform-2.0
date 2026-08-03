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
