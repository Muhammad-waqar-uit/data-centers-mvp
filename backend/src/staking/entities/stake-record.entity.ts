import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum StakeAction {
  DEPOSIT = 'deposit',
  WITHDRAW = 'withdraw',
  LOCK = 'lock',
  RELEASE = 'release',
  SLASH = 'slash',
  REWARD = 'reward',
}

@Entity('stake_records')
export class StakeRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  walletAddress: string;

  @Column({ type: 'enum', enum: StakeAction })
  action: StakeAction;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  claimId: string;

  @Column({ nullable: true })
  referenceId: string;

  @Column({ nullable: true })
  txHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
