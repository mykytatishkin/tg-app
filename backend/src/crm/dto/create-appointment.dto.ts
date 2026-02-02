import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
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
}
