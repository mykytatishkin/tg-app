import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const appUrl = this.configService.get<string>('MINI_APP_URL');

    if (!token) return;
    if (!appUrl) {
      console.warn('MINI_APP_URL not set - bot will not show Open App button');
    }

    this.bot = new Telegraf(token);

    this.bot.start((ctx) => {
      const url = appUrl || 'https://example.com';
      return ctx.reply('Welcome! Tap the button below to open the app.', Markup.inlineKeyboard([
        [Markup.button.webApp('Open App', url)],
      ]));
    });

    this.bot.launch().catch((err) => {
      console.error('Bot launch error:', err);
    });
  }

  onModuleDestroy() {
    this.bot?.stop();
  }
}
