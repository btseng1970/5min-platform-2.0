import type { Pool, PoolClient } from "pg";
import { createPool, queryOutboxEventsByCorrelationId, withTransaction, writeOutboxEvent } from "./index";

describe("createPool", () => {
  it("constructs a Pool without connecting eagerly", () => {
    const pool = createPool("postgres://fake:fake@localhost:5432/fake");
    expect(typeof pool.query).toBe("function");
    expect(typeof pool.connect).toBe("function");
  });
});

function fakeClient(queryImpl: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>): PoolClient {
  return {
    query: jest.fn(queryImpl),
    release: jest.fn(),
  } as unknown as PoolClient;
}

describe("withTransaction", () => {
  it("wraps fn in BEGIN/COMMIT and releases the client on success", async () => {
    const calls: string[] = [];
    const client = fakeClient(async (text) => {
      calls.push(text.trim());
      return { rows: [] };
    });
    const pool = { connect: jest.fn(async () => client) } as unknown as Pool;

    const result = await withTransaction(pool, async () => {
      calls.push("fn");
      return "done";
    });

    expect(result).toBe("done");
    expect(calls).toEqual(["BEGIN", "fn", "COMMIT"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rolls back and releases the client, then rethrows, when fn throws", async () => {
    const calls: string[] = [];
    const client = fakeClient(async (text) => {
      calls.push(text.trim());
      return { rows: [] };
    });
    const pool = { connect: jest.fn(async () => client) } as unknown as Pool;

    await expect(
      withTransaction(pool, async () => {
        calls.push("fn");
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(calls).toEqual(["BEGIN", "fn", "ROLLBACK"]);
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describe("writeOutboxEvent", () => {
  it("inserts a PENDING row with the given fields", async () => {
    let capturedParams: unknown[] | undefined;
    const client = fakeClient(async (_text, params) => {
      capturedParams = params;
      return { rows: [] };
    });

    await writeOutboxEvent(client, {
      eventId: "event-1",
      eventType: "TestEvent",
      aggregateType: "test_aggregate",
      aggregateId: "agg-1",
      aggregateVersion: 1,
      payload: { foo: "bar" },
      correlationId: "corr-1",
    });

    expect(capturedParams).toEqual(["event-1", "TestEvent", "test_aggregate", "agg-1", 1, JSON.stringify({ foo: "bar" }), "corr-1", null]);
  });

  it("defaults causationId to null when omitted", async () => {
    let capturedParams: unknown[] | undefined;
    const client = fakeClient(async (_text, params) => {
      capturedParams = params;
      return { rows: [] };
    });

    await writeOutboxEvent(client, {
      eventId: "event-2",
      eventType: "TestEvent",
      aggregateType: "test_aggregate",
      aggregateId: "agg-2",
      aggregateVersion: 1,
      payload: {},
      correlationId: "corr-2",
      causationId: "cause-2",
    });

    expect(capturedParams?.[7]).toBe("cause-2");
  });
});

describe("queryOutboxEventsByCorrelationId", () => {
  it("maps rows to OutboxEventRecord and queries by correlation_id", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    let capturedParams: unknown[] | undefined;
    const pool = {
      query: jest.fn(async (_text: string, params: unknown[]) => {
        capturedParams = params;
        return {
          rows: [
            {
              event_id: "event-1",
              event_type: "QRCodeScanned",
              aggregate_type: "qr_code",
              aggregate_id: "qr-1",
              status: "PENDING",
              correlation_id: "corr-1",
              causation_id: null,
              created_at: now,
              published_at: null,
            },
          ],
        };
      }),
    } as unknown as Pool;

    const records = await queryOutboxEventsByCorrelationId(pool, "corr-1");

    expect(capturedParams).toEqual(["corr-1"]);
    expect(records).toEqual([
      {
        eventId: "event-1",
        eventType: "QRCodeScanned",
        aggregateType: "qr_code",
        aggregateId: "qr-1",
        status: "PENDING",
        correlationId: "corr-1",
        causationId: null,
        createdAt: now,
        publishedAt: null,
      },
    ]);
  });

  it("returns an empty array when nothing matches", async () => {
    const pool = { query: jest.fn(async () => ({ rows: [] })) } as unknown as Pool;

    const records = await queryOutboxEventsByCorrelationId(pool, "nonexistent");

    expect(records).toEqual([]);
  });
});
