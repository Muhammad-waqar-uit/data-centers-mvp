import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ClaimsService } from './claims.service';
import { ClaimsController } from './claims.controller';
import { ClaimsProcessor } from './claims.processor';
import { Claim } from './entities/claim.entity';
import { UsersModule } from '../users/users.module';

// Only register BullMQ queue and processor when Redis is available
const hasRedis = !!process.env.REDIS_HOST;

const bullImports = hasRedis
  ? [BullModule.registerQueue({ name: 'claims' })]
  : [];

const processors = hasRedis ? [ClaimsProcessor] : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([Claim]),
    ...bullImports,
    UsersModule,
  ],
  controllers: [ClaimsController],
  providers: [ClaimsService, ...processors],
  exports: [ClaimsService],
})
export class ClaimsModule {}
