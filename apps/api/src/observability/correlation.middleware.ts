import { randomUUID } from "node:crypto";
import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { runWithCorrelationId } from "./correlation-context";

const HEADER_NAME = "x-correlation-id";

/**
 * Assigns a correlation_id to every request — reusing an inbound
 * x-correlation-id header if present, generating a new UUID otherwise —
 * makes it available via getCorrelationId() for the lifetime of the request
 * (including inside async domain-service calls), and echoes it back on the
 * response header. FND-010 minimum subset: request -> domain write ->
 * event_outbox row -> log line, all sharing the same value.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const inbound = req.header(HEADER_NAME);
    const correlationId = inbound && inbound.trim() !== "" ? inbound : randomUUID();
    res.setHeader(HEADER_NAME, correlationId);
    runWithCorrelationId(correlationId, () => next());
  }
}
