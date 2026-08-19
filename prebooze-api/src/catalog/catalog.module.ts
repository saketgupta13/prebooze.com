import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { RedirectController } from './redirect.controller';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CatalogController, RedirectController],
  providers: [CatalogService, PrismaService],
})
export class CatalogModule {}
