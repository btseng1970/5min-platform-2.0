// Canonical API error envelope (TDS §2.3 Common Error Model). Every API error
// response uses exactly this shape; no ad-hoc error object is ever returned.

export type CanonicalErrorCode =
  | "VALIDATION_FAILED"
  | "AUTH_REQUIRED"
  | "POLICY_BLOCKED"
  | "RESOURCE_NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "STATE_CONFLICT"
  | "RESOURCE_LOCKED"
  | "RATE_LIMITED"
  | "DRAW_PAUSED";

export const HTTP_STATUS_BY_ERROR_CODE: Record<CanonicalErrorCode, number> = {
  VALIDATION_FAILED: 400,
  AUTH_REQUIRED: 401,
  POLICY_BLOCKED: 403,
  RESOURCE_NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 409,
  STATE_CONFLICT: 409,
  RESOURCE_LOCKED: 423,
  RATE_LIMITED: 429,
  DRAW_PAUSED: 503,
};

export interface CanonicalErrorEnvelope {
  error_code: CanonicalErrorCode;
  message: string;
  details: Record<string, unknown> | null;
  correlation_id: string;
  retry_after_seconds: number | null;
}

export class CanonicalApiError extends Error {
  readonly errorCode: CanonicalErrorCode;
  readonly details: Record<string, unknown> | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    errorCode: CanonicalErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = "CanonicalApiError";
    this.errorCode = errorCode;
    this.details = options?.details ?? null;
    this.retryAfterSeconds = options?.retryAfterSeconds ?? null;
  }

  get httpStatus(): number {
    return HTTP_STATUS_BY_ERROR_CODE[this.errorCode];
  }

  toEnvelope(correlationId: string): CanonicalErrorEnvelope {
    return {
      error_code: this.errorCode,
      message: this.message,
      details: this.details,
      correlation_id: correlationId,
      retry_after_seconds: this.retryAfterSeconds,
    };
  }
}
