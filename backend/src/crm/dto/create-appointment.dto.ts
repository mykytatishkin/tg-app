import { IsString, IsOptional, IsNotEmpty, IsEnum, IsBoolean, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

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

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  withDiscount?: boolean;

  @IsString()
  @IsOptional()
  discountLabel?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  discountPercent?: number;
}
