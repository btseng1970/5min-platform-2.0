import { Body, Controller, Inject, Post } from "@nestjs/common";
import { QrService } from "@5min/domain-qr";
import { CanonicalApiError } from "errors";
import type { FlagProvider } from "@5min/shared-flags";
import { FLAG_PROVIDER } from "../flags/flags.module";
import { DemoMemberContextProvider } from "../members/demo-member-context.provider";
import { getCorrelationId } from "../observability/correlation-context";
import { QR_SERVICE } from "./qr.tokens";

interface QrScanRequestBody {
  code?: unknown;
  client_request_id?: unknown;
}

interface QrScanResponseBody {
  qr_code_id: string;
  state: "USED";
}

@Controller("qr")
export class QrController {
  constructor(
    @Inject(QR_SERVICE) private readonly qrService: QrService,
    @Inject(FLAG_PROVIDER) private readonly flags: FlagProvider,
    private readonly memberContext: DemoMemberContextProvider,
  ) {}

  @Post("scan")
  async scan(@Body() body: QrScanRequestBody): Promise<QrScanResponseBody> {
    if (!this.flags.isEnabled("proto_qr_scan")) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", "QR scan is not enabled.");
    }
    if (typeof body.code !== "string" || body.code.length === 0) {
      throw new CanonicalApiError("VALIDATION_FAILED", "code is required.");
    }
    if (typeof body.client_request_id !== "string" || body.client_request_id.length === 0) {
      throw new CanonicalApiError("VALIDATION_FAILED", "client_request_id is required.");
    }

    // member_id is never accepted from the caller — it comes only from the
    // deterministic server-side demo context.
    const memberId = this.memberContext.resolveMemberId();

    const result = await this.qrService.scan({
      rawCode: body.code,
      memberId,
      clientRequestId: body.client_request_id,
      correlationId: getCorrelationId(),
    });

    return { qr_code_id: result.qrCodeId, state: result.state };
  }
}
