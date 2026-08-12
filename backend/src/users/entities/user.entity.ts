import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Claim } from '../../claims/entities/claim.entity';

export enum UserRole {
  CONTRIBUTOR = 'contributor',
  VERIFIER = 'verifier',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ unique: true, nullable: true })
  walletAddress: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CONTRIBUTOR })
  role: UserRole;

  @Column({ default: 0 })
  reputationScore: number;

  @Column({ default: 0 })
  totalClaimsSubmitted: number;

  @Column({ default: 0 })
  totalClaimsVerified: number;

  @Column({ default: 0 })
  totalEarnings: number; // in USDC cents

  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Claim, (claim) => claim.claimer)
  claims: Claim[];
}
