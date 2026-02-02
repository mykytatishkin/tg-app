import { IsString, IsOptional, IsNotEmpty, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  durationMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price?: number;
}
