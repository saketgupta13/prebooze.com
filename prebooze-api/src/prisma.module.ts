import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() + imported once in AppModule — every feature module used to
// list PrismaService in its own `providers:` array instead of importing a
// shared module. NestJS gives each module-local provider declaration its
// own instance unless it's exported from an imported module, so that
// pattern was silently creating ~21 separate PrismaClient instances (one
// per module that touched the DB), each opening its own connection pool —
// confirmed via pg_stat_activity hitting Postgres's max_connections (100)
// within seconds of a fresh boot, well before any real traffic (real
// incident, 2026-09-23). @Global() means every module gets the single
// exported instance automatically, no per-module `imports:` needed.
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
@Global()
export class PrismaModule {}
