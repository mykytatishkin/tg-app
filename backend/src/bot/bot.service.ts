import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import {
  getSessionKey,
  quickTestSessions,
  QUICK_TEST_QUESTIONS,
  selectCourses,
  type MockCourse,
} from './quick-test.state';

function formatCoursesMessage(courses: MockCourse[]): string {
  const lines = courses.map(
    (c, i) =>
      `<b>${i + 1}. ${escapeHtml(c.name)}</b>\n${escapeHtml(c.description)}\nMore: t.me/bot?start=course_${c.id}`,
  );
  return 'Based on your answers, we suggest:\n\n' + lines.join('\n\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

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

    this.bot.command('quick-test', (ctx) => {
      const key = getSessionKey(ctx);
      if (!key) return ctx.reply('Could not start quick test.');
      quickTestSessions.set(key, { step: 0, answers: [] });
      return ctx.reply(`Quick test (1/${QUICK_TEST_QUESTIONS.length})\n\n${QUICK_TEST_QUESTIONS[0]}`, {
        parse_mode: 'HTML',
      });
    });

    this.bot.on('text', async (ctx, next) => {
      const key = getSessionKey(ctx);
      const text = ctx.message.text.trim();
      const state = key ? quickTestSessions.get(key) : undefined;

      if (!state) return next();

      if (text === 'Cancel' || /^\/cancel$/i.test(text)) {
        quickTestSessions.delete(key!);
        return ctx.reply('Quick test cancelled.');
      }

      state.answers.push(text);
      state.step += 1;

      if (state.step < QUICK_TEST_QUESTIONS.length) {
        return ctx.reply(
          `(${state.step + 1}/${QUICK_TEST_QUESTIONS.length})\n\n${QUICK_TEST_QUESTIONS[state.step]}`,
          { parse_mode: 'HTML' },
        );
      }

      quickTestSessions.delete(key!);
      const courses = selectCourses(state.answers);
      return ctx.reply(formatCoursesMessage(courses), { parse_mode: 'HTML' });
    });

    this.bot.launch().catch((err) => {
      console.error('Bot launch error:', err);
    });
  }

  onModuleDestroy() {
    this.bot?.stop();
  }

  /** Send a text message to a user by their Telegram ID (chat_id). */
  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error('Bot sendMessage error:', err);
    }
  }

  /** Send a message with an inline "Web App" button (e.g. "Записаться"). */
  async sendMessageWithWebAppButton(
    chatId: string,
    text: string,
    buttonLabel: string,
    webAppUrl: string,
  ): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: buttonLabel, web_app: { url: webAppUrl } }]],
        },
      });
    } catch (err) {
      console.error('Bot sendMessageWithWebAppButton error:', err);
    }
  }
}
