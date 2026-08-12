import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataCentersService } from './data-centers.service';
import { DataCentersController } from './data-centers.controller';
import { DataCenter } from './entities/data-center.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DataCenter])],
  controllers: [DataCentersController],
  providers: [DataCentersService],
  exports: [DataCentersService],
})
export class DataCentersModule {}
