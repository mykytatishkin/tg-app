import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  Min,
  IsArray,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGiveawayDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  winnerCount?: number;

  @IsOptional()
  @IsArray()
  conditions?: { type: string; value?: string }[];
}
