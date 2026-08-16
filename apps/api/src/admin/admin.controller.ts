import { Controller, Get, Inject, Query } from "@nestjs/common";
import { queryOutboxEventsByCorrelationId, type OutboxEventRecord } from "@5min/shared-db";
import type { Pool } from "pg";
import { CanonicalApiError } from "errors";
import { PG_POOL } from "../db/db.module";
import { InternalDemoAdminContext } from "./internal-demo-admin-context";

interface AuditLogEntryResponseBody {
  event_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  status: string;
  correlation_id: string;
  causation_id: string | null;
  created_at: string;
  published_at: string | null;
}

// Internal admin route only — deliberately not under the /api/v1 prefix
// (excluded in main.ts's setGlobalPrefix call). No standalone auth
// mechanism exists for this internal Prototype; InternalDemoAdminContext's
// double-flag gate (proto_internal_demo_runtime AND proto_admin_trace) is
// the sole gate, matching the rest of this Prototype's unauthenticated-
// internal-demo scope. No caller-supplied role/identity is ever consulted.
@Controller("admin/api/v1/audit-log")
export class AdminController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly adminContext: InternalDemoAdminContext,
  ) {}

  @Get()
  async getAuditLog(@Query("correlation_id") correlationId: string | undefined): Promise<AuditLogEntryResponseBody[]> {
    if (!this.adminContext.isAvailable()) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", "Admin correlation trace is not enabled.");
    }
    if (typeof correlationId !== "string" || correlationId.length === 0) {
      throw new CanonicalApiError("VALIDATION_FAILED", "correlation_id query parameter is required.");
    }

    const records = await queryOutboxEventsByCorrelationId(this.pool, correlationId);
    return records.map((record) => this.toResponseBody(record));
  }

  private toResponseBody(record: OutboxEventRecord): AuditLogEntryResponseBody {
    return {
      event_id: record.eventId,
      event_type: record.eventType,
      aggregate_type: record.aggregateType,
      aggregate_id: record.aggregateId,
      status: record.status,
      correlation_id: record.correlationId,
      causation_id: record.causationId,
      created_at: record.createdAt.toISOString(),
      published_at: record.publishedAt ? record.publishedAt.toISOString() : null,
    };
  }
}
