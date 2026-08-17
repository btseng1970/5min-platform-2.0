import { CanonicalApiError, HTTP_STATUS_BY_ERROR_CODE } from "./index";

describe("CanonicalApiError", () => {
  it("maps every canonical error code to its exact HTTP status", () => {
    expect(HTTP_STATUS_BY_ERROR_CODE.VALIDATION_FAILED).toBe(400);
    expect(HTTP_STATUS_BY_ERROR_CODE.AUTH_REQUIRED).toBe(401);
    expect(HTTP_STATUS_BY_ERROR_CODE.POLICY_BLOCKED).toBe(403);
    expect(HTTP_STATUS_BY_ERROR_CODE.RESOURCE_NOT_FOUND).toBe(404);
    expect(HTTP_STATUS_BY_ERROR_CODE.IDEMPOTENCY_CONFLICT).toBe(409);
    expect(HTTP_STATUS_BY_ERROR_CODE.STATE_CONFLICT).toBe(409);
    expect(HTTP_STATUS_BY_ERROR_CODE.RESOURCE_LOCKED).toBe(423);
    expect(HTTP_STATUS_BY_ERROR_CODE.RATE_LIMITED).toBe(429);
    expect(HTTP_STATUS_BY_ERROR_CODE.DRAW_PAUSED).toBe(503);
  });

  it("produces the exact canonical envelope shape", () => {
    const error = new CanonicalApiError("STATE_CONFLICT", "QR code has already been used.", {
      details: { qr_code_id: "qr_123" },
    });

    const envelope = error.toEnvelope("corr_abc");

    expect(envelope).toEqual({
      error_code: "STATE_CONFLICT",
      message: "QR code has already been used.",
      details: { qr_code_id: "qr_123" },
      correlation_id: "corr_abc",
      retry_after_seconds: null,
    });
    expect(error.httpStatus).toBe(409);
  });

  it("defaults details and retry_after_seconds to null when not provided", () => {
    const error = new CanonicalApiError("RESOURCE_NOT_FOUND", "Campaign not found.");
    const envelope = error.toEnvelope("corr_xyz");

    expect(envelope.details).toBeNull();
    expect(envelope.retry_after_seconds).toBeNull();
  });
});
