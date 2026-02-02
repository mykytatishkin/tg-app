import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { CrmModule } from './crm/crm.module';
import { AppointmentsModule } from './appointments/appointments.module';

@Module({
  imports: [SharedModule, AuthModule, BotModule, CrmModule, AppointmentsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
