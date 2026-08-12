import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { DataCenter, DataCenterStatus } from './entities/data-center.entity';
import { CreateDataCenterDto, UpdateDataCenterDto, QueryDataCentersDto } from './dto/data-center.dto';

@Injectable()
export class DataCentersService {
  constructor(
    @InjectRepository(DataCenter)
    private dcRepo: Repository<DataCenter>,
  ) {}

  async create(dto: CreateDataCenterDto, registeredBy?: string): Promise<DataCenter> {
    const dc = this.dcRepo.create({ ...dto, registeredBy });
    return this.dcRepo.save(dc);
  }

  async findAll(query: QueryDataCentersDto): Promise<{ data: DataCenter[]; total: number }> {
    const where: FindOptionsWhere<DataCenter> = {};

    if (query.search) {
      where.name = Like(`%${query.search}%`);
    }
    if (query.country) {
      where.country = query.country;
    }
    if (query.status) {
      where.status = query.status;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await this.dcRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total };
  }

  async findOne(id: string): Promise<DataCenter> {
    const dc = await this.dcRepo.findOne({ where: { id }, relations: ['claims'] });
    if (!dc) throw new NotFoundException('Data center not found');
    return dc;
  }

  async update(id: string, dto: UpdateDataCenterDto): Promise<DataCenter> {
    await this.dcRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.dcRepo.delete(id);
  }

  async getGeoJSON(): Promise<any> {
    const dataCenters = await this.dcRepo.find({ where: { isPublic: true } });

    return {
      type: 'FeatureCollection',
      features: dataCenters.map((dc) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(dc.longitude), Number(dc.latitude)],
        },
        properties: {
          id: dc.id,
          name: dc.name,
          country: dc.country,
          region: dc.region,
          city: dc.city,
          status: dc.status,
          ownerType: dc.ownerType,
          ownerName: dc.ownerName,
          powerCapacityMW: dc.powerCapacityMW,
          sizeMW: dc.sizeMW,
        },
      })),
    };
  }
}
