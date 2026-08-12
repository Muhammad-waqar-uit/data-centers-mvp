import { Injectable, NotFoundException, BadRequestException, Optional, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Queue } from 'bullmq';

import { Claim, ClaimStatus } from './entities/claim.entity';
import { SubmitClaimDto, AttestClaimDto, ChallengeClaimDto, QueryClaimsDto } from './dto/claim.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class ClaimsService {
  constructor(
    @InjectRepository(Claim)
    private claimsRepo: Repository<Claim>,
    private usersService: UsersService,
    @Optional() @Inject('BullQueue_claims')
    private claimsQueue?: Queue,
  ) {}

  async submit(userId: string, dto: SubmitClaimDto): Promise<Claim> {
    const claim = this.claimsRepo.create({
      ...dto,
      claimerId: userId,
      status: ClaimStatus.PENDING,
      stakeAmount: 20, // default minimum
    });

    const saved = await this.claimsRepo.save(claim);
    await this.usersService.incrementClaimsSubmitted(userId);

    return saved;
  }

  async findAll(query: QueryClaimsDto): Promise<{ data: Claim[]; total: number }> {
    const where: FindOptionsWhere<Claim> = {};

    if (query.dataCenterId) where.dataCenterId = query.dataCenterId;
    if (query.factType) where.factType = query.factType;
    if (query.status) where.status = query.status as ClaimStatus;

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await this.claimsRepo.findAndCount({
      where,
      relations: ['claimer', 'dataCenter'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return { data, total };
  }

  async findOne(id: string): Promise<Claim> {
    const claim = await this.claimsRepo.findOne({
      where: { id },
      relations: ['claimer', 'dataCenter'],
    });
    if (!claim) throw new NotFoundException('Claim not found');
    return claim;
  }

  async findUserClaims(userId: string): Promise<Claim[]> {
    return this.claimsRepo.find({
      where: { claimerId: userId },
      relations: ['dataCenter'],
      order: { createdAt: 'DESC' },
    });
  }

  async findPendingForVerification(): Promise<Claim[]> {
    return this.claimsRepo.find({
      where: { status: ClaimStatus.PENDING },
      relations: ['claimer', 'dataCenter'],
      order: { createdAt: 'ASC' },
      take: 50,
    });
  }

  async attest(claimId: string, verifierId: string, dto: AttestClaimDto): Promise<Claim> {
    const claim = await this.findOne(claimId);

    if (claim.status !== ClaimStatus.PENDING) {
      throw new BadRequestException('Claim is not in pending status');
    }
    if (claim.claimerId === verifierId) {
      throw new BadRequestException('Cannot attest your own claim');
    }

    const challengeWindowEnd = new Date();
    challengeWindowEnd.setDate(challengeWindowEnd.getDate() + 7); // 7-day window

    claim.status = ClaimStatus.ATTESTED;
    claim.verifierId = verifierId;
    claim.verifierWallet = dto.verifierWallet;
    claim.verifierStakeAmount = 200;
    claim.attestedAt = new Date();
    claim.challengeWindowEnd = challengeWindowEnd;

    const saved = await this.claimsRepo.save(claim);
    await this.usersService.incrementClaimsVerified(verifierId);

    // Schedule auto-finalization after challenge window (only if Redis/BullMQ is available)
    if (this.claimsQueue) {
      await this.claimsQueue.add(
        'finalize-claim',
        { claimId: saved.id },
        { delay: 7 * 24 * 60 * 60 * 1000 }, // 7 days
      );
    }

    return saved;
  }

  async challenge(claimId: string, challengerId: string, dto: ChallengeClaimDto): Promise<Claim> {
    const claim = await this.findOne(claimId);

    if (claim.status !== ClaimStatus.ATTESTED) {
      throw new BadRequestException('Claim is not attested');
    }

    if (claim.challengeWindowEnd && new Date() > claim.challengeWindowEnd) {
      throw new BadRequestException('Challenge window has closed');
    }

    claim.status = ClaimStatus.CHALLENGED;
    claim.challengerId = challengerId;
    claim.challengerWallet = dto.challengerWallet;
    claim.challengeReason = dto.reason;
    claim.challengedAt = new Date();

    return this.claimsRepo.save(claim);
  }

  async finalize(claimId: string): Promise<Claim> {
    const claim = await this.findOne(claimId);

    if (claim.status !== ClaimStatus.ATTESTED) {
      throw new BadRequestException('Claim cannot be finalized');
    }

    claim.status = ClaimStatus.FINALIZED;

    return this.claimsRepo.save(claim);
  }

  async resolveDispute(claimId: string, claimCorrect: boolean): Promise<Claim> {
    const claim = await this.findOne(claimId);

    if (claim.status !== ClaimStatus.CHALLENGED) {
      throw new BadRequestException('Claim is not in dispute');
    }

    claim.status = claimCorrect ? ClaimStatus.FINALIZED : ClaimStatus.REJECTED;
    return this.claimsRepo.save(claim);
  }
}
