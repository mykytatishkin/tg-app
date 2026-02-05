import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotService } from './bot.service';
import { Appointment } from '../crm/entities/appointment.entity';
import { AppointmentFeedback } from '../crm/entities/appointment-feedback.entity';
import { User } from '../auth/entities/user.entity';
import { Suggestion } from '../suggestions/entities/suggestion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, AppointmentFeedback, User, Suggestion]),
  ],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
