import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CanonicalExceptionFilter } from './errors/canonical-exception.filter';
import { resolveCorsPolicy } from './cors/cors-policy';

// Local-development-only convenience: loads repo-root .env.development when
// present and DATABASE_URL is not already set by the real environment. Never
// touches a shared/production environment, which always sets DATABASE_URL
// externally and never ships this file's values.
function loadDevelopmentEnvIfPresent(): void {
  if (process.env.DATABASE_URL) return;
  const devEnvPath = resolve(__dirname, '..', '..', '..', '.env.development');
  if (existsSync(devEnvPath)) {
    process.loadEnvFile(devEnvPath);
  }
}

async function bootstrap() {
  loadDevelopmentEnvIfPresent();
  const app = await NestFactory.create(AppModule);
  // Explicit allowlist only, never a wildcard/reflected origin. Default
  // (PROTOTYPE_DEMO_ALLOWED_ORIGINS unset — true for any zero-config
  // runtime, including production) is fully restrictive. Local dev opts in
  // via .env.development so apps/web's browser-side journey panel can call
  // the API from a different dev-server port. Not gated by a Prototype
  // flag: this is transport-level wiring, not domain behavior.
  app.enableCors(resolveCorsPolicy(process.env));
  app.useGlobalFilters(new CanonicalExceptionFilter());
  app.setGlobalPrefix('api/v1', { exclude: ['healthz', 'admin/api/v1/audit-log'] });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`apps/api listening on port ${port}`);
}

bootstrap();
