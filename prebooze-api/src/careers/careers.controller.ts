import { Body, Controller, Get, Post } from '@nestjs/common';
import { CareersService } from './careers.service';

@Controller('careers')
export class CareersController {
  constructor(private careers: CareersService) {}

  @Get('jobs')
  jobs() {
    return this.careers.jobs();
  }

  @Post('apply')
  apply(@Body() body: Parameters<CareersService['apply']>[0]) {
    return this.careers.apply(body);
  }
}
