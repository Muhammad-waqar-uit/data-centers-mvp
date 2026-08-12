import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Claim } from '../../claims/entities/claim.entity';

export enum DataCenterStatus {
  PLANNED = 'planned',
  UNDER_CONSTRUCTION = 'under_construction',
  OPERATING = 'operating',
  STALLED = 'stalled',
  DECOMMISSIONED = 'decommissioned',
}

export enum OwnerType {
  PUBLIC_COMPANY = 'public_company',
  PRIVATE_COMPANY = 'private_company',
  FUND = 'fund',
  SOVEREIGN_ENTITY = 'sovereign_entity',
  GOVERNMENT = 'government',
  JOINT_VENTURE = 'joint_venture',
  UNKNOWN = 'unknown',
}

@Entity('data_centers')
export class DataCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  longitude: number;

  @Column()
  country: string;

  @Column({ nullable: true })
  region: string;

  @Column({ nullable: true })
  city: string;

  @Column({ type: 'enum', enum: DataCenterStatus, default: DataCenterStatus.PLANNED })
  status: DataCenterStatus;

  @Column({ type: 'enum', enum: OwnerType, default: OwnerType.UNKNOWN })
  ownerType: OwnerType;

  @Column({ nullable: true })
  ownerName: string;

  @Column({ nullable: true })
  powerCapacityMW: number;

  @Column({ nullable: true })
  sizeMW: number;

  @Column({ nullable: true })
  gridStatus: string; // interconnection queue position, status

  @Column({ nullable: true })
  interconnectionQueueId: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isPublic: boolean;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  onChainId: number; // ID from DataCenterRegistry contract

  @Column({ nullable: true })
  registeredBy: string; // wallet address of registrar

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Claim, (claim) => claim.dataCenter)
  claims: Claim[];
}
