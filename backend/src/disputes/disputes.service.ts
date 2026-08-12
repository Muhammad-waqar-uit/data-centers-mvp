import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeResolution } from './entities/dispute.entity';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(Dispute)
    private disputesRepo: Repository<Dispute>,
  ) {}

  async findAll(): Promise<Dispute[]> {
    return this.disputesRepo.find({
      relations: ['claim', 'claim.claimer', 'claim.dataCenter'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Dispute> {
    const dispute = await this.disputesRepo.findOne({
      where: { id },
      relations: ['claim', 'claim.claimer', 'claim.dataCenter'],
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  async findByClaim(claimId: string): Promise<Dispute | null> {
    return this.disputesRepo.findOne({
      where: { claimId },
      relations: ['claim'],
    });
  }

  async resolve(id: string, resolution: DisputeResolution, resolvedBy: string): Promise<Dispute> {
    const dispute = await this.findOne(id);
    dispute.resolution = resolution;
    dispute.resolvedBy = resolvedBy;
    dispute.resolvedAt = new Date();
    return this.disputesRepo.save(dispute);
  }
}
