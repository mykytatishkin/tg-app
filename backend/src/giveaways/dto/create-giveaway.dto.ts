import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  Min,
  IsArray,
  IsDateString,
  IsBoolean,
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

  /** When true, participant must submit a link proving they fulfilled conditions. */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requireConditionsProof?: boolean;
}
