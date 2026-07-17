import { Module } from '@nestjs/common';
import { HealthzController } from './healthz/healthz.controller';

@Module({
  controllers: [HealthzController],
})
export class AppModule {}
