import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Get()
  findAll() {
    return this.disputesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.disputesService.findOne(id);
  }
}
