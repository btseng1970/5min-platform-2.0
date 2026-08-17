import { Controller, Get, Inject } from "@nestjs/common";
import { WalletService } from "@5min/domain-wallet";
import { CanonicalApiError } from "errors";
import type { FlagProvider } from "@5min/shared-flags";
import { FLAG_PROVIDER } from "../flags/flags.module";
import { DemoMemberContextProvider } from "../members/demo-member-context.provider";
import { WALLET_SERVICE } from "./wallet.tokens";

interface WalletSummaryResponseBody {
  available_points: number;
}

@Controller("wallet")
export class WalletController {
  constructor(
    @Inject(WALLET_SERVICE) private readonly walletService: WalletService,
    @Inject(FLAG_PROVIDER) private readonly flags: FlagProvider,
    private readonly memberContext: DemoMemberContextProvider,
  ) {}

  @Get()
  async getSummary(): Promise<WalletSummaryResponseBody> {
    if (!this.flags.isEnabled("proto_wallet_grant")) {
      throw new CanonicalApiError("RESOURCE_NOT_FOUND", "Wallet is not enabled.");
    }
    const memberId = this.memberContext.resolveMemberId();
    const summary = await this.walletService.getSummary(memberId);
    return { available_points: summary.availablePoints };
  }
}
