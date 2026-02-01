import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';

@Module({
  imports: [SharedModule, AuthModule, BotModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
