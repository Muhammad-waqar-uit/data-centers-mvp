import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Claim, ClaimStatus } from './entities/claim.entity';

@Processor('claims')
export class ClaimsProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Claim)
    private claimsRepo: Repository<Claim>,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'finalize-claim':
        await this.finalizeClaim(job.data.claimId);
        break;
    }
  }

  private async finalizeClaim(claimId: string): Promise<void> {
    const claim = await this.claimsRepo.findOne({ where: { id: claimId } });
    if (!claim) return;

    // Only finalize if still in ATTESTED status (not challenged)
    if (claim.status === ClaimStatus.ATTESTED) {
      claim.status = ClaimStatus.FINALIZED;
      await this.claimsRepo.save(claim);
    }
  }
}
