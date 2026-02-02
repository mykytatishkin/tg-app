import { PartialType } from '@nestjs/mapped-types';
import { IsString, IsOptional } from 'class-validator';
import { CreateAppointmentDto } from './create-appointment.dto';

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
  @IsString()
  @IsOptional()
  cancellationReason?: string;
}
