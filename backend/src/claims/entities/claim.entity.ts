import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { DataCenter } from '../../data-centers/entities/data-center.entity';

export enum FactType {
  INTERCONNECTION_QUEUE = 'interconnection_queue',
  OWNERSHIP = 'ownership',
  GRID_STATUS = 'grid_status',
  POWER_CAPACITY = 'power_capacity',
  CONSTRUCTION_STATUS = 'construction_status',
  TRANSACTION_HISTORY = 'transaction_history',
  LAND_USE = 'land_use',
  WATER_COOLING = 'water_cooling',
  FIBER_CONNECTIVITY = 'fiber_connectivity',
  OTHER = 'other',
}

export enum ClaimStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  ATTESTED = 'attested',
  CHALLENGED = 'challenged',
  FINALIZED = 'finalized',
  REJECTED = 'rejected',
}

@Entity('claims')
export class Claim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  dataCenterId: string;

  @ManyToOne(() => DataCenter, (dc) => dc.claims)
  @JoinColumn({ name: 'dataCenterId' })
  dataCenter: DataCenter;

  @Column()
  claimerId: string;

  @ManyToOne(() => User, (user) => user.claims)
  @JoinColumn({ name: 'claimerId' })
  claimer: User;

  @Column({ type: 'enum', enum: FactType })
  factType: FactType;

  @Column({ type: 'text' })
  factData: string;

  @Column({ nullable: true })
  proofDocumentUrl: string;

  @Column({ nullable: true })
  proofHash: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  stakeAmount: number;

  @Column({ type: 'enum', enum: ClaimStatus, default: ClaimStatus.PENDING })
  status: ClaimStatus;

  @Column({ nullable: true })
  txHash: string; // on-chain transaction hash

  @Column({ nullable: true })
  onChainClaimId: number; // ID from ClaimVerification contract

  @Column({ nullable: true })
  verifierId: string;

  @Column({ nullable: true })
  verifierWallet: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  verifierStakeAmount: number;

  @Column({ type: 'timestamp', nullable: true })
  attestedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  challengeWindowEnd: Date;

  @Column({ nullable: true })
  challengerId: string;

  @Column({ nullable: true })
  challengerWallet: string;

  @Column({ type: 'text', nullable: true })
  challengeReason: string;

  @Column({ type: 'timestamp', nullable: true })
  challengedAt: Date;

  @Column({ nullable: true })
  finalizedTxHash: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
