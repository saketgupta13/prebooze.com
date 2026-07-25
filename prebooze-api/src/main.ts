import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true populates req.rawBody alongside the normal parsed JSON —
  // needed to verify the Razorpay webhook's HMAC signature over the exact
  // bytes sent, without disabling body parsing for every other route.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.setGlobalPrefix('v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });
  // KYC document uploads — served outside the /v1 prefix, matches the paths
  // StorageService returns ("/uploads/…"). Swap for S3/CDN URLs later.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
