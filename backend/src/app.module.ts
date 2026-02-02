import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { CrmModule } from './crm/crm.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { GiveawaysModule } from './giveaways/giveaways.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    SharedModule,
    AuthModule,
    BotModule,
    CrmModule,
    AppointmentsModule,
    GiveawaysModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
