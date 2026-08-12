import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MapService } from './map.service';

@ApiTags('map')
@Controller('map')
export class MapController {
  constructor(private mapService: MapService) {}

  @Get('geojson')
  getGeoJSON() {
    return this.mapService.getGeoJSON();
  }

  @Get('stats')
  getStats() {
    return this.mapService.getMapStats();
  }
}
