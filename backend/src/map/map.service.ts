import { Injectable } from '@nestjs/common';
import { DataCentersService } from '../data-centers/data-centers.service';

@Injectable()
export class MapService {
  constructor(private dcService: DataCentersService) {}

  async getGeoJSON() {
    return this.dcService.getGeoJSON();
  }

  async getMapStats() {
    const { total } = await this.dcService.findAll({ page: 1, limit: 1 });
    return {
      totalDataCenters: total,
    };
  }
}
