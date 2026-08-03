import { Global, Module } from "@nestjs/common";
import { EnvFlagProvider, type FlagProvider } from "@5min/shared-flags";

export const FLAG_PROVIDER = Symbol("FLAG_PROVIDER");

/**
 * The only place in apps/api that reads process.env for Prototype flags —
 * everything downstream depends on the injected FlagProvider interface only
 * (domain core never reads environment variables directly).
 */
@Global()
@Module({
  providers: [
    {
      provide: FLAG_PROVIDER,
      useFactory: (): FlagProvider => new EnvFlagProvider(process.env),
    },
  ],
  exports: [FLAG_PROVIDER],
})
export class FlagsModule {}
