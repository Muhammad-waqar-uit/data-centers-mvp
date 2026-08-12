import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DataCenterStatus, OwnerType } from '../entities/data-center.entity';

export class CreateDataCenterDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  latitude: number;

  @ApiProperty()
  @IsNumber()
  longitude: number;

  @ApiProperty()
  @IsString()
  country: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(DataCenterStatus)
  status?: DataCenterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(OwnerType)
  ownerType?: OwnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  powerCapacityMW?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sizeMW?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gridStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  interconnectionQueueId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateDataCenterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(DataCenterStatus)
  status?: DataCenterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(OwnerType)
  ownerType?: OwnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  powerCapacityMW?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sizeMW?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gridStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class QueryDataCentersDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(DataCenterStatus)
  status?: DataCenterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;
}
