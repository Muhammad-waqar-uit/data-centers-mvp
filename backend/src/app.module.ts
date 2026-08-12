import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DataCentersModule } from './data-centers/data-centers.module';
import { ClaimsModule } from './claims/claims.module';
import { DisputesModule } from './disputes/disputes.module';
import { StakingModule } from './staking/staking.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { MapModule } from './map/map.module';
import { UploadsModule } from './uploads/uploads.module';

import { User } from './users/entities/user.entity';
import { DataCenter } from './data-centers/entities/data-center.entity';
import { Claim } from './claims/entities/claim.entity';
import { Dispute } from './disputes/entities/dispute.entity';
import { StakeRecord } from './staking/entities/stake-record.entity';

// Only configure BullMQ when REDIS_HOST is set (skip if Redis is not available)
const bullImports = process.env.REDIS_HOST
  ? [
      BullModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          connection: {
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
          },
        }),
      }),
    ]
  : [];

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    // Supports two modes:
    //   1. DATABASE_URL (Supabase / hosted Postgres) — connection string with SSL
    //   2. Individual DATABASE_HOST/PORT/USER/PASSWORD/NAME — local Postgres
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get('DATABASE_URL');

        if (databaseUrl) {
          // Supabase / connection-string mode (SSL required)
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [User, DataCenter, Claim, Dispute, StakeRecord],
            synchronize: config.get('NODE_ENV') === 'development',
            logging: config.get('NODE_ENV') === 'development',
            ssl: { rejectUnauthorized: false },
          };
        }

        // Local Postgres mode
        return {
          type: 'postgres',
          host: config.get('DATABASE_HOST', 'localhost'),
          port: config.get<number>('DATABASE_PORT', 5432),
          username: config.get('DATABASE_USER', 'postgres'),
          password: config.get('DATABASE_PASSWORD', 'postgres'),
          database: config.get('DATABASE_NAME', 'data_centers'),
          entities: [User, DataCenter, Claim, Dispute, StakeRecord],
          synchronize: config.get('NODE_ENV') === 'development',
          logging: config.get('NODE_ENV') === 'development',
        };
      },
    }),

    // BullMQ (optional — only when Redis is available)
    ...bullImports,

    // Feature modules
    AuthModule,
    UsersModule,
    DataCentersModule,
    ClaimsModule,
    DisputesModule,
    StakingModule,
    BlockchainModule,
    MapModule,
    UploadsModule,
  ],
})
export class AppModule {}
