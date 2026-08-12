import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StakingService } from './staking.service';
import { StakingController } from './staking.controller';
import { StakeRecord } from './entities/stake-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StakeRecord])],
  controllers: [StakingController],
  providers: [StakingService],
  exports: [StakingService],
})
export class StakingModule {}
