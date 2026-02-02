import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { User } from '../auth/entities/user.entity';
import { Client } from '../crm/entities/client.entity';
import { Service } from '../crm/entities/service.entity';
import { Appointment } from '../crm/entities/appointment.entity';
import { AvailabilitySlot } from '../crm/entities/availability-slot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Client,
      Service,
      Appointment,
      AvailabilitySlot,
    ]),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
