import { IsString, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';

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
}
