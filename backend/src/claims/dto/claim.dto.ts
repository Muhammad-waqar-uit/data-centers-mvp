import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FactType } from '../entities/claim.entity';

export class SubmitClaimDto {
  @ApiProperty()
  @IsString()
  dataCenterId: string;

  @ApiProperty({ enum: FactType })
  @IsEnum(FactType)
  factType: FactType;

  @ApiProperty()
  @IsString()
  factData: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proofDocumentUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proofHash?: string;
}

export class AttestClaimDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  verifierWallet?: string;
}

export class ChallengeClaimDto {
  @ApiProperty()
  @IsString()
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  challengerWallet?: string;
}

export class QueryClaimsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dataCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(FactType)
  factType?: FactType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;
}
