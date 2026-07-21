import { Module } from '@nestjs/common';
import { CareersController } from './careers.controller';
import { CareersService } from './careers.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CareersController],
  providers: [CareersService, PrismaService],
})
export class CareersModule {}
