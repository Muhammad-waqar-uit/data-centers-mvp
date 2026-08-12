import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByWallet(walletAddress: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { walletAddress: walletAddress.toLowerCase() } });
  }

  async updateProfile(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepo.update(id, data);
    return this.findById(id);
  }

  async linkWallet(id: string, walletAddress: string): Promise<User> {
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new BadRequestException('Invalid wallet address');
    }
    const normalized = walletAddress.toLowerCase();
    const existing = await this.usersRepo.findOne({ where: { walletAddress: normalized } });
    if (existing && existing.id !== id) {
      throw new ConflictException('Wallet already linked to another account');
    }
    await this.usersRepo.update(id, { walletAddress: normalized });
    return this.findById(id);
  }

  async incrementReputation(id: string, amount: number): Promise<void> {
    await this.usersRepo.increment({ id }, 'reputationScore', amount);
  }

  async incrementClaimsSubmitted(id: string): Promise<void> {
    await this.usersRepo.increment({ id }, 'totalClaimsSubmitted', 1);
  }

  async incrementClaimsVerified(id: string): Promise<void> {
    await this.usersRepo.increment({ id }, 'totalClaimsVerified', 1);
  }
}
