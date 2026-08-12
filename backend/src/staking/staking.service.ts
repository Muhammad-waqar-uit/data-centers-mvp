import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StakeRecord, StakeAction } from './entities/stake-record.entity';

@Injectable()
export class StakingService {
  constructor(
    @InjectRepository(StakeRecord)
    private stakeRepo: Repository<StakeRecord>,
  ) {}

  async getUserHistory(userId: string): Promise<StakeRecord[]> {
    return this.stakeRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async recordAction(
    userId: string,
    action: StakeAction,
    amount: number,
    claimId?: string,
    txHash?: string,
  ): Promise<StakeRecord> {
    const record = this.stakeRepo.create({
      userId,
      action,
      amount,
      claimId,
      txHash,
    });
    return this.stakeRepo.save(record);
  }

  async getUserStats(userId: string) {
    const deposits = await this.stakeRepo
      .createQueryBuilder('sr')
      .select('COALESCE(SUM(sr.amount), 0)', 'total')
      .where('sr.userId = :userId', { userId })
      .andWhere('sr.action IN (:...actions)', { actions: [StakeAction.DEPOSIT, StakeAction.REWARD] })
      .getRawOne();

    const withdrawals = await this.stakeRepo
      .createQueryBuilder('sr')
      .select('COALESCE(SUM(sr.amount), 0)', 'total')
      .where('sr.userId = :userId', { userId })
      .andWhere('sr.action IN (:...actions)', { actions: [StakeAction.WITHDRAW, StakeAction.SLASH] })
      .getRawOne();

    return {
      totalDeposited: Number(deposits?.total) || 0,
      totalWithdrawn: Number(withdrawals?.total) || 0,
      netBalance: (Number(deposits?.total) || 0) - (Number(withdrawals?.total) || 0),
    };
  }
}
