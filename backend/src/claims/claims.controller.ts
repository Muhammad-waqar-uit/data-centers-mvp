import {
  Controller, Get, Post,
  Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClaimsService } from './claims.service';
import { SubmitClaimDto, AttestClaimDto, ChallengeClaimDto, QueryClaimsDto } from './dto/claim.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('claims')
@Controller('claims')
export class ClaimsController {
  constructor(private claimsService: ClaimsService) {}

  @Get()
  findAll(@Query() query: QueryClaimsDto) {
    return this.claimsService.findAll(query);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findPending() {
    return this.claimsService.findPendingForVerification();
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findMyClaims(@Request() req) {
    return this.claimsService.findUserClaims(req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.claimsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  submit(@Request() req, @Body() dto: SubmitClaimDto) {
    return this.claimsService.submit(req.user.sub, dto);
  }

  @Post(':id/attest')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  attest(@Param('id') id: string, @Request() req, @Body() dto: AttestClaimDto) {
    return this.claimsService.attest(id, req.user.sub, dto);
  }

  @Post(':id/challenge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  challenge(@Param('id') id: string, @Request() req, @Body() dto: ChallengeClaimDto) {
    return this.claimsService.challenge(id, req.user.sub, dto);
  }
}
