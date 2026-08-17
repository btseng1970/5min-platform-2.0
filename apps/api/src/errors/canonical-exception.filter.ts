import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { CanonicalApiError } from "errors";
import { getCorrelationId } from "../observability/correlation-context";

/**
 * Formats every CanonicalApiError thrown by domain/application code into
 * TDS's exact canonical error envelope. Errors that are not a
 * CanonicalApiError are not this filter's concern — they represent a genuine
 * unexpected bug, not a documented API contract case, and are left to
 * Nest's own default handler (logged, generic 500).
 */
@Catch(CanonicalApiError)
export class CanonicalExceptionFilter implements ExceptionFilter {
  catch(exception: CanonicalApiError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const correlationId = getCorrelationId();
    response.status(exception.httpStatus).json(exception.toEnvelope(correlationId));
  }
}
