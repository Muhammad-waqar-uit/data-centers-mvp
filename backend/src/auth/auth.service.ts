import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ethers } from 'ethers';

import { User, UserRole } from '../users/entities/user.entity';
import { RegisterDto, LoginDto, WalletLoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepo.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
      role: UserRole.CONTRIBUTOR,
    });

    const saved = await this.usersRepo.save(user);
    return this.generateToken(saved);
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async walletLogin(dto: WalletLoginDto) {
    // Verify EIP-712 signature
    const recoveredAddress = ethers.verifyMessage(dto.message, dto.signature);
    if (recoveredAddress.toLowerCase() !== dto.walletAddress.toLowerCase()) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    // Find or create user
    let user = await this.usersRepo.findOne({
      where: { walletAddress: dto.walletAddress.toLowerCase() },
    });

    if (!user) {
      user = this.usersRepo.create({
        walletAddress: dto.walletAddress.toLowerCase(),
        role: UserRole.CONTRIBUTOR,
        displayName: `${dto.walletAddress.slice(0, 6)}...${dto.walletAddress.slice(-4)}`,
      });
      user = await this.usersRepo.save(user);
    }

    return this.generateToken(user);
  }

  private generateToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        walletAddress: user.walletAddress,
        role: user.role,
        displayName: user.displayName,
        reputationScore: user.reputationScore,
      },
    };
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
