import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CustomTimeRequestsController } from './custom-time-requests.controller';
import { CustomTimeRequestsService } from './custom-time-requests.service';
import { CustomTimeRequest } from '../crm/entities/custom-time-request.entity';
import { User } from '../auth/entities/user.entity';
import { Client } from '../crm/entities/client.entity';
import { Service } from '../crm/entities/service.entity';
import { AvailabilitySlot } from '../crm/entities/availability-slot.entity';
import { Appointment } from '../crm/entities/appointment.entity';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomTimeRequest,
      User,
      Client,
      Service,
      AvailabilitySlot,
      Appointment,
    ]),
    ConfigModule,
    BotModule,
  ],
  controllers: [CustomTimeRequestsController],
  providers: [CustomTimeRequestsService],
})
export class CustomTimeRequestsModule {}
