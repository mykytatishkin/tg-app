import { IsString, IsOptional, IsBoolean, IsNotEmpty, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  /** Minus = discount, plus = extra charge. */
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  priceModifier?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  forModels?: boolean;
}
