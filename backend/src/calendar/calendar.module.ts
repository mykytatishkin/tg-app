import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { User } from '../auth/entities/user.entity';
import { Appointment } from '../crm/entities/appointment.entity';
import { AvailabilitySlot } from '../crm/entities/availability-slot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Appointment, AvailabilitySlot])],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
