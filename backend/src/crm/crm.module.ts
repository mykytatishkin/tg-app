import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { ClientRemindersService } from './client-reminders.service';
import { Client } from './entities/client.entity';
import { Service } from './entities/service.entity';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { Appointment } from './entities/appointment.entity';
import { MonthlyExpense } from './entities/monthly-expense.entity';
import { User } from '../auth/entities/user.entity';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, Service, AvailabilitySlot, Appointment, MonthlyExpense, User]),
    BotModule,
  ],
  controllers: [CrmController],
  providers: [CrmService, ClientRemindersService],
})
export class CrmModule {}
