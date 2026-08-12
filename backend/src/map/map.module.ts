import { Module } from '@nestjs/common';
import { MapController } from './map.controller';
import { MapService } from './map.service';
import { DataCentersModule } from '../data-centers/data-centers.module';

@Module({
  imports: [DataCentersModule],
  controllers: [MapController],
  providers: [MapService],
})
export class MapModule {}
