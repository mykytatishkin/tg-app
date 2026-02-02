import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Telegraf, Markup } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';
import type { Context } from 'telegraf';
import {
  getSessionKey,
  quickTestSessions,
  QUICK_TEST_QUESTIONS,
  selectCourses,
  type MockCourse,
  type QuickTestQuestion,
} from './quick-test.state';
import { Appointment, AppointmentStatus } from '../crm/entities/appointment.entity';

const QUICK_TEST_IMAGE_PATH = path.join(process.cwd(), 'assets', 'quick-test-heart.png');
const QT_CB_PREFIX = 'qt_';
const DRINK_CB_PREFIX = 'drink_';

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

function getQuestionCaption(step: number): string {
  const q = QUICK_TEST_QUESTIONS[step];
  return `Быстрый тест (${step + 1}/${QUICK_TEST_QUESTIONS.length})\n\n${q.text}`;
}

function buildQuestionKeyboard(step: number): ReturnType<typeof Markup.inlineKeyboard> | undefined {
  const q = QUICK_TEST_QUESTIONS[step];
  if (!q.options?.length) return undefined;
  const row = q.options.map((opt, idx) =>
    Markup.button.callback(opt, `${QT_CB_PREFIX}${step}_${idx}`),
  );
  return Markup.inlineKeyboard(row.map((b) => [b]));
}

async function sendQuestion(ctx: Context, step: number): Promise<unknown> {
  const caption = getQuestionCaption(step);
  const keyboard = buildQuestionKeyboard(step);
  const hasImage = fs.existsSync(QUICK_TEST_IMAGE_PATH);

  if (hasImage) {
    return ctx.replyWithPhoto(
      { source: fs.createReadStream(QUICK_TEST_IMAGE_PATH) },
      {
        caption,
        parse_mode: 'HTML',
        ...(keyboard ? { reply_markup: keyboard.reply_markup } : {}),
      },
    );
  }
  return ctx.reply(caption, {
    parse_mode: 'HTML',
    ...(keyboard ? { reply_markup: keyboard.reply_markup } : {}),
  });
}

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf | null = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
  ) {}

  onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    const appUrl = this.configService.get<string>('MINI_APP_URL');

    if (!token) return;
    if (!appUrl) {
      console.warn('MINI_APP_URL not set - bot will not show Open App button');
    }

    this.bot = new Telegraf(token);

    // Кнопка меню рядом с полем ввода — открывает mini-app
    if (appUrl) {
      this.bot.telegram
        .setChatMenuButton({
          menuButton: {
            type: 'web_app',
            text: 'Открыть приложение',
            web_app: { url: appUrl },
          },
        })
        .catch((err) => console.warn('setChatMenuButton error:', err));
    }

    this.bot.start((ctx) => {
      const url = appUrl || 'https://example.com';
      return ctx.reply(
        'Привет! Выберите действие:',
        Markup.inlineKeyboard([
          [Markup.button.callback('Пройти тест', 'start_quick_test')],
          [Markup.button.webApp('Открыть приложение', url)],
        ]),
      );
    });

    // Кнопка «Пройти тест» при /start
    this.bot.action('start_quick_test', async (ctx) => {
      await ctx.answerCbQuery();
      const key = getSessionKey(ctx);
      if (!key) return ctx.reply('Не удалось начать тест.');
      quickTestSessions.set(key, { step: 0, answers: [] });
      return sendQuestion(ctx, 0);
    });

    this.bot.command('quick-test', (ctx) => {
      const key = getSessionKey(ctx);
      if (!key) return ctx.reply('Не удалось начать тест.');
      quickTestSessions.set(key, { step: 0, answers: [] });
      return sendQuestion(ctx, 0);
    });

    // Выбор варианта ответа кнопкой (callback qt_step_optionIndex)
    // Выбор напитка клиентом перед сеансом → уведомление мастеру
    this.bot.action(new RegExp(`^${DRINK_CB_PREFIX}`), async (ctx) => {
      const data = (ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '') ?? '';
      if (!data.startsWith(DRINK_CB_PREFIX)) return;
      const payload = data.slice(DRINK_CB_PREFIX.length);
      const sep = payload.indexOf('|');
      if (sep === -1) return;
      const appointmentId = payload.slice(0, sep);
      const optionIndex = parseInt(payload.slice(sep + 1), 10);
      await ctx.answerCbQuery();

      const appointment = await this.appointmentRepo.findOne({
        where: { id: appointmentId, status: AppointmentStatus.SCHEDULED },
        relations: ['client', 'master'],
      });
      if (!appointment?.master?.telegramId) return;

      const options = (appointment.master as { drinkOptions?: string[] | null }).drinkOptions ?? [];
      const optionText = options[optionIndex] ?? 'напиток';
      const clientName = appointment.client?.name ?? 'Клиент';
      const clientUsername = appointment.client?.username?.trim();
      const mention = clientUsername ? `@${clientUsername}` : clientName;

      const apptDate = new Date(`${appointment.date}T${(appointment.startTime || '').slice(0, 5)}:00`);
      const minutesLeft = Math.max(0, Math.round((apptDate.getTime() - Date.now()) / 60000));
      const text = `${mention} будет через ${minutesLeft} мин и желает выпить <b>${escapeHtml(optionText)}</b>.`;
      await this.sendMessage(appointment.master.telegramId, text);
    });

    this.bot.action(/^qt_(\d+)_(\d+)$/, async (ctx) => {
      const key = getSessionKey(ctx);
      const state = key ? quickTestSessions.get(key) : undefined;
      const match = ctx.match;
      if (!match || !state) {
        await ctx.answerCbQuery();
        return;
      }
      const step = parseInt(match[1], 10);
      const optionIndex = parseInt(match[2], 10);
      if (step !== state.step) {
        await ctx.answerCbQuery();
        return;
      }
      const q = QUICK_TEST_QUESTIONS[step] as QuickTestQuestion;
      const optionText = q.options?.[optionIndex];
      if (optionText == null) {
        await ctx.answerCbQuery();
        return;
      }
      await ctx.answerCbQuery();
      state.answers.push(optionText);
      state.step += 1;

      if (state.step < QUICK_TEST_QUESTIONS.length) {
        return sendQuestion(ctx, state.step);
      }
      quickTestSessions.delete(key);
      const courses = selectCourses(state.answers);
      return ctx.reply(formatCoursesMessage(courses), { parse_mode: 'HTML' });
    });

    this.bot.on('text', async (ctx, next) => {
      const key = getSessionKey(ctx);
      const text = ctx.message.text.trim();
      const state = key ? quickTestSessions.get(key) : undefined;

      if (!state) return next();

      if (text === 'Cancel' || /^\/cancel$/i.test(text)) {
        quickTestSessions.delete(key!);
        return ctx.reply('Тест отменён.');
      }

      const currentQ = QUICK_TEST_QUESTIONS[state.step] as QuickTestQuestion;
      if (currentQ.options?.length) {
        return ctx.reply('Пожалуйста, выберите вариант кнопкой выше.');
      }

      state.answers.push(text);
      state.step += 1;

      if (state.step < QUICK_TEST_QUESTIONS.length) {
        return sendQuestion(ctx, state.step);
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

  /** Send a text message to a user by their Telegram ID (chat_id). Returns true if sent. */
  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML' });
      return true;
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : '';
      console.error('Bot sendMessage error:', err);
      if (msg?.includes("can't initiate") || msg?.includes('blocked') || msg?.includes('deactivated')) {
        console.warn(`User ${chatId} must start the bot first (send /start in chat with the bot).`);
      }
      return false;
    }
  }

  /** Напоминание клиенту за 5–10 мин: «У вас скоро сеанс, желаете что-то выпить?» + кнопки напитков. */
  async sendDrinkReminderToClient(
    chatId: string,
    appointmentId: string,
    drinkOptions: string[],
  ): Promise<boolean> {
    if (!this.bot || !drinkOptions.length) return false;
    try {
      const rows = drinkOptions.map((label, idx) => [
        Markup.button.callback(label, `${DRINK_CB_PREFIX}${appointmentId}|${idx}`),
      ]);
      await this.bot.telegram.sendMessage(chatId, 'У вас скоро сеанс, желаете что-то выпить?', {
        reply_markup: { inline_keyboard: rows },
      });
      return true;
    } catch (err) {
      console.error('Bot sendDrinkReminderToClient error:', err);
      return false;
    }
  }

  /** Send a message with an inline "Web App" button (e.g. "Записаться"). */
  async sendMessageWithWebAppButton(
    chatId: string,
    text: string,
    buttonLabel: string,
    webAppUrl: string,
  ): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: buttonLabel, web_app: { url: webAppUrl } }]],
        },
      });
      return true;
    } catch (err) {
      console.error('Bot sendMessageWithWebAppButton error:', err);
      return false;
    }
  }
}
