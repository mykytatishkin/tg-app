import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class BookAppointmentDto {
  @IsString()
  @IsOptional()
  masterId?: string;

  @IsString()
  @IsOptional()
  serviceId?: string;

  @IsString()
  @IsOptional()
  slotId?: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsNotEmpty()
  startTime: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  referenceImageUrl?: string;
}
