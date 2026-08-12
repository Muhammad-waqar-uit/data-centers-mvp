import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DataCentersService } from './data-centers.service';
import { CreateDataCenterDto, UpdateDataCenterDto, QueryDataCentersDto } from './dto/data-center.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('data-centers')
@Controller('data-centers')
export class DataCentersController {
  constructor(private dcService: DataCentersService) {}

  @Get()
  findAll(@Query() query: QueryDataCentersDto) {
    return this.dcService.findAll(query);
  }

  @Get('geojson')
  getGeoJSON() {
    return this.dcService.getGeoJSON();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dcService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@Body() dto: CreateDataCenterDto, @Request() req) {
    return this.dcService.create(dto, req.user.walletAddress);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: UpdateDataCenterDto) {
    return this.dcService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.dcService.remove(id);
  }
}
