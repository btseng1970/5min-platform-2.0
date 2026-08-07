import { Controller, Get, Headers, Inject, Param, Post, Body } from "@nestjs/common";
import { DrawService } from "@5min/domain-reward";
import { CanonicalApiError } from "errors";
import type { FlagProvider } from "@5min/shared-flags";
import { FLAG_PROVIDER } from "../flags/flags.module";
import { DemoMemberContextProvider } from "../members/demo-member-context.provider";
import { getCorrelationId } from "../observability/correlation-context";
import { DRAW_SERVICE } from "./reward.tokens";

interface DrawRequestBody {
  campaign_id?: unknown;
  client_request_id?: unknown;
}

interface DrawResponseBody {
  draw_id: string;
  state: "DrawReserved";
  draw_result: {
    result_type: string;
    prize_tier: string | null;
  };
}

@Controller("reward")
export class RewardController {
  constructor(
    @Inject(DRAW_SERVICE) private readonly drawService: DrawService,
    @Inject(FLAG_PROVIDER) private readonly flags: FlagProvider,
    private readonly memberContext: DemoMemberContextProvider,
  ) {}

  @Post("draws")
  async createDraw(
    @Body() body: DrawRequestBody,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
  ): Promise<DrawResponseBody> {
    this.assertEnabled();
    if (typeof body.campaign_id !== "string" || body.campaign_id.length === 0) {
      throw new CanonicalApiError("VALIDATION_FAILED", "campaign_id is required.");
    }
    if (typeof body.client_request_id !== "string" || body.client_request_id.length === 0) {
      throw new CanonicalApiError("VALIDATION_FAILED", "client_request_id is required.");
    }
    if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
      throw new CanonicalApiError("VALIDATION_FAILED", "Idempotency-Key header is required.");
    }

    const memberId = this.memberContext.resolveMemberId();

    const result = await this.drawService.draw({
      campaignId: body.campaign_id,
      memberId,
      clientRequestId: body.client_request_id,
      idempotencyKey,
      correlationId: getCorrelationId(),
    });

    return this.toResponseBody(result);
  }

  @Get("draws/:draw_id")
  async getDraw(@Param("draw_id") drawId: string): Promise<DrawResponseBody> {
    this.assertEnabled();
    const result = await this.drawService.getById(drawId);
    return this.toResponseBody(result);
  }

  private assertEnabled(): void {
    if (!this.flags.isEnabled("proto_draw")) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", "Reward draws are not enabled.");
    }
  }

  private toResponseBody(result: Awaited<ReturnType<DrawService["getById"]>>): DrawResponseBody {
    return {
      draw_id: result.drawId,
      state: result.state,
      draw_result: { result_type: result.drawResult.resultType, prize_tier: result.drawResult.prizeTier },
    };
  }
}
