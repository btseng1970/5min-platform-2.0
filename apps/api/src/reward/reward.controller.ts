import { Controller, Get, Headers, Inject, Param, Post, Body } from "@nestjs/common";
import { DrawService } from "@5min/domain-reward";
import { WalletService } from "@5min/domain-wallet";
import { CollectionService } from "@5min/domain-ip-asset";
import { CanonicalApiError } from "errors";
import type { FlagProvider } from "@5min/shared-flags";
import { FLAG_PROVIDER } from "../flags/flags.module";
import { DemoMemberContextProvider } from "../members/demo-member-context.provider";
import { getCorrelationId } from "../observability/correlation-context";
import { WALLET_SERVICE } from "../wallet/wallet.tokens";
import { COLLECTION_SERVICE } from "../collection/collection.tokens";
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
    point_amount: number | null;
  };
}

@Controller("reward")
export class RewardController {
  constructor(
    @Inject(DRAW_SERVICE) private readonly drawService: DrawService,
    @Inject(WALLET_SERVICE) private readonly walletService: WalletService,
    @Inject(COLLECTION_SERVICE) private readonly collectionService: CollectionService,
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
    const correlationId = getCorrelationId();

    const result = await this.drawService.draw({
      campaignId: body.campaign_id,
      memberId,
      clientRequestId: body.client_request_id,
      idempotencyKey,
      correlationId,
    });

    // BFF-orchestrated composition, not a cross-schema SQL write: this calls
    // WalletService's own public API, which only ever touches wallet.* —
    // DrawService never reads or writes wallet.* itself. Idempotent per
    // draw_id (UNIQUE(source_type, source_id) in wallet.ledger_entry), so
    // this is safe to call unconditionally on every POINT result, including
    // idempotent draw replays — it never double-credits.
    if (result.drawResult.resultType === "POINT" && result.drawResult.pointAmount !== null) {
      await this.walletService.postDrawPoints({
        memberId,
        drawId: result.drawId,
        amount: result.drawResult.pointAmount,
        correlationId,
      });
    }

    // Same BFF-composition pattern as the wallet posting above: calls
    // CollectionService's own public API (ip_asset.* only), idempotent per
    // (member_id, item_id), so safe on every PRIZE result including replays.
    if (result.drawResult.resultType === "PRIZE" && result.drawResult.prizeTier !== null) {
      await this.collectionService.unlockFromPrizeDraw({
        memberId,
        prizeTierId: result.drawResult.prizeTier,
        drawId: result.drawId,
        correlationId,
      });
    }

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
      draw_result: {
        result_type: result.drawResult.resultType,
        prize_tier: result.drawResult.prizeTier,
        point_amount: result.drawResult.pointAmount,
      },
    };
  }
}
