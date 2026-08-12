import { Controller, Get, Put, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getProfile(@Request() req) {
    return this.usersService.findById(req.user.sub);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateProfile(@Request() req, @Body() data: any) {
    return this.usersService.updateProfile(req.user.sub, data);
  }

  @Patch('me/wallet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  linkWallet(@Request() req, @Body() body: { walletAddress: string }) {
    return this.usersService.linkWallet(req.user.sub, body.walletAddress);
  }
}
