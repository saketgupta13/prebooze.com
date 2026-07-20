import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
