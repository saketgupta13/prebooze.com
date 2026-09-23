import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { CatalogService } from '../catalog/catalog.service';

@Module({
  controllers: [ShareController],
  providers: [ShareService, CatalogService],
})
export class ShareModule {}
