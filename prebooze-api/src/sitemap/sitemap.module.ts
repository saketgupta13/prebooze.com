import { Module } from '@nestjs/common';
import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SitemapController],
  providers: [SitemapService, PrismaService],
})
export class SitemapModule {}
