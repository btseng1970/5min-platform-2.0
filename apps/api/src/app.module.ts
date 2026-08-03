import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HealthzController } from './healthz/healthz.controller';
import { FlagsModule } from './flags/flags.module';
import { DbModule } from './db/db.module';
import { CorrelationMiddleware } from './observability/correlation.middleware';
import { CampaignsModule } from './campaigns/campaigns.module';

@Module({
  imports: [FlagsModule, DbModule, CampaignsModule],
  controllers: [HealthzController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
