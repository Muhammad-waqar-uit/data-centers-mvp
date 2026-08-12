import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Claim } from '../../claims/entities/claim.entity';

export enum DisputeResolution {
  PENDING = 'pending',
  CLAIM_CORRECT = 'claim_correct',
  CLAIM_INCORRECT = 'claim_incorrect',
}

@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  claimId: string;

  @ManyToOne(() => Claim)
  @JoinColumn({ name: 'claimId' })
  claim: Claim;

  @Column()
  challengerId: string;

  @Column({ nullable: true })
  challengerWallet: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  challengeStake: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'enum', enum: DisputeResolution, default: DisputeResolution.PENDING })
  resolution: DisputeResolution;

  @Column({ type: 'text', nullable: true })
  juryDecision: string;

  @Column({ nullable: true })
  resolvedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  txHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
