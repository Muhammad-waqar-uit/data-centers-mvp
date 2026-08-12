import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StakingService } from './staking.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('staking')
@Controller('staking')
export class StakingController {
  constructor(private stakingService: StakingService) {}

  @Get('me/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getHistory(@Request() req) {
    return this.stakingService.getUserHistory(req.user.sub);
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getStats(@Request() req) {
    return this.stakingService.getUserStats(req.user.sub);
  }
}
