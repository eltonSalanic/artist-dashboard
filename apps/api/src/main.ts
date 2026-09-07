import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Resend's webhook signature covers the exact bytes received, and
  // body-parser's parse-then-restringify is not byte-identical.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:3000' });
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
