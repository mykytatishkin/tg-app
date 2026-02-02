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
import { AppointmentFeedback } from '../crm/entities/appointment-feedback.entity';

const QUICK_TEST_IMAGE_PATH = path.join(process.cwd(), 'assets', 'quick-test-heart.png');
const QT_CB_PREFIX = 'qt_';
const DRINK_CB_PREFIX = 'drink_';
const FEEDBACK_CB_PREFIX = 'feedback_';

export interface FeedbackSessionState {
  appointmentId: string;
  step: 'comment' | 'whatGood' | 'done';
  rating: number;
  comment: string | null;
  selectedGood: number[];
  options: string[];
}

export const feedbackSessions = new Map<string, FeedbackSessionState>();

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
    @InjectRepository(AppointmentFeedback)
    private feedbackRepo: Repository<AppointmentFeedback>,
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
            text: 'открыть запись',
            web_app: { url: appUrl },
          },
        })
        .catch((err) => console.warn('setChatMenuButton error:', err));
    }

    this.bot.start((ctx) => {
      const url = appUrl || 'https://example.com';
      return ctx.reply(
        'приветик! предлагаю тебе записаться ко мне либо подписаться на мой инстаграм <3',
        Markup.inlineKeyboard([
          [Markup.button.webApp('открыть запись', url)],
          [Markup.button.url('Инстаграм @murrnails_', 'https://instagram.com/murrnails_')],
        ]),
      );
    });

    // ——— Обработчики отзыва после сеанса ———
    this.bot.action(new RegExp(`^${FEEDBACK_CB_PREFIX}stars_`), async (ctx) => {
      const data = (ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '') ?? '';
      const match = data.match(/^feedback_stars_([^_]+)_(\d)$/);
      if (!match) {
        await ctx.answerCbQuery();
        return;
      }
      const [, appointmentId, ratingStr] = match;
      const rating = parseInt(ratingStr, 10);
      if (rating < 1 || rating > 5) {
        await ctx.answerCbQuery();
        return;
      }
      const appointment = await this.appointmentRepo.findOne({
        where: { id: appointmentId, status: AppointmentStatus.DONE },
        relations: ['client', 'master'],
      });
      if (!appointment) {
        await ctx.answerCbQuery();
        return ctx.reply('Запись не найдена или сеанс ещё не завершён.');
      }
      const chatId = String(ctx.chat?.id ?? ctx.from?.id ?? '');
      if (appointment.client?.telegramId !== chatId) {
        await ctx.answerCbQuery();
        return ctx.reply('Этот отзыв не для вас.');
      }
      const existing = await this.feedbackRepo.findOne({ where: { appointmentId } });
      if (existing) {
        await ctx.answerCbQuery();
        return ctx.reply('Вы уже оставили отзыв по этому сеансу.');
      }
      const options =
        (appointment.master as { feedbackOptions?: string[] | null })?.feedbackOptions ??
        ['Качество работы', 'Общение', 'Атмосфера', 'Скорость'];
      const opts = Array.isArray(options) && options.length > 0 ? options : ['Качество работы', 'Общение', 'Атмосфера', 'Скорость'];
      feedbackSessions.set(chatId, {
        appointmentId,
        step: 'comment',
        rating,
        comment: null,
        selectedGood: [],
        options: opts,
      });
      await ctx.answerCbQuery();
      return ctx.reply('Напишите комментарий к сеансу (или нажмите «Пропустить»).', {
        reply_markup: {
          inline_keyboard: [[{ text: 'Пропустить', callback_data: `feedback_skip_comment_${appointmentId}` }]],
        },
      });
    });

    this.bot.action(new RegExp(`^${FEEDBACK_CB_PREFIX}skip_comment_`), async (ctx) => {
      const data = (ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '') ?? '';
      const appointmentId = data.replace(/^feedback_skip_comment_/, '');
      const key = getSessionKey(ctx);
      const state = key ? feedbackSessions.get(key) : undefined;
      if (!state || state.appointmentId !== appointmentId) {
        await ctx.answerCbQuery();
        return;
      }
      await ctx.answerCbQuery();
      state.comment = null;
      state.step = 'whatGood';
      if (state.options.length > 0) {
        const rows = state.options.map((label, idx) => [
          Markup.button.callback(label, `feedback_good_${appointmentId}_${idx}`),
        ]);
        rows.push([Markup.button.callback('Готово', `feedback_done_${appointmentId}`)]);
        return ctx.reply('Что понравилось? (можно выбрать несколько)', {
          reply_markup: { inline_keyboard: rows },
        });
      }
      await this.saveFeedbackAndReply(ctx, state);
    });

    this.bot.action(new RegExp(`^${FEEDBACK_CB_PREFIX}good_`), async (ctx) => {
      const data = (ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '') ?? '';
      const match = data.match(/^feedback_good_([^_]+)_(\d+)$/);
      if (!match) {
        await ctx.answerCbQuery();
        return;
      }
      const [, appointmentId, idxStr] = match;
      const key = getSessionKey(ctx);
      const state = key ? feedbackSessions.get(key) : undefined;
      if (!state || state.appointmentId !== appointmentId) {
        await ctx.answerCbQuery();
        return;
      }
      const idx = parseInt(idxStr, 10);
      if (state.selectedGood.includes(idx)) {
        state.selectedGood = state.selectedGood.filter((i) => i !== idx);
      } else {
        state.selectedGood.push(idx);
      }
      await ctx.answerCbQuery(`Выбрано: ${state.selectedGood.length}`);
    });

    this.bot.action(new RegExp(`^${FEEDBACK_CB_PREFIX}done_`), async (ctx) => {
      const data = (ctx.callbackQuery && 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : '') ?? '';
      const appointmentId = data.replace(/^feedback_done_/, '');
      const key = getSessionKey(ctx);
      const state = key ? feedbackSessions.get(key) : undefined;
      if (!state || state.appointmentId !== appointmentId) {
        await ctx.answerCbQuery();
        return;
      }
      await ctx.answerCbQuery();
      await this.saveFeedbackAndReply(ctx, state);
    });

    // Резервный обработчик для старой кнопки «Пройти тест»
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
      const feedbackState = key ? feedbackSessions.get(key) : undefined;
      if (feedbackState && feedbackState.step === 'comment') {
        feedbackState.comment = text.slice(0, 2000);
        feedbackState.step = 'whatGood';
        if (feedbackState.options.length > 0) {
          const rows = feedbackState.options.map((label, idx) => [
            Markup.button.callback(label, `feedback_good_${feedbackState.appointmentId}_${idx}`),
          ]);
          rows.push([Markup.button.callback('Готово', `feedback_done_${feedbackState.appointmentId}`)]);
          return ctx.reply('Что понравилось? (можно выбрать несколько)', {
            reply_markup: { inline_keyboard: rows },
          });
        }
        await this.saveFeedbackAndReply(ctx, feedbackState);
        return;
      }
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

  /** Напоминание клиенту за 5–10 мин: «приветик! у тебя скоро запись, будешь что-то пить?» + кнопки напитков. */
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
      await this.bot.telegram.sendMessage(chatId, 'приветик! у тебя скоро запись, будешь что-то пить?', {
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

  /** Request feedback from client after session: "Оцените сеанс 1–5 звёзд" + inline buttons. */
  async sendFeedbackRequest(
    chatId: string,
    appointmentId: string,
    options: string[],
  ): Promise<boolean> {
    if (!this.bot) return false;
    try {
      const stars = [1, 2, 3, 4, 5].map((n) =>
        Markup.button.callback(String(n), `feedback_stars_${appointmentId}_${n}`),
      );
      await this.bot.telegram.sendMessage(
        chatId,
        'Спасибо за визит! Оцените сеанс от 1 до 5 звёзд.',
        { reply_markup: { inline_keyboard: [stars] } },
      );
      return true;
    } catch (err) {
      console.error('Bot sendFeedbackRequest error:', err);
      return false;
    }
  }

  private async saveFeedbackAndReply(
    ctx: Context,
    state: FeedbackSessionState,
  ): Promise<void> {
    const key = getSessionKey(ctx);
    if (!key) return;
    const existing = await this.feedbackRepo.findOne({
      where: { appointmentId: state.appointmentId },
    });
    if (existing) {
      feedbackSessions.delete(key);
      await ctx.reply('Вы уже оставили отзыв по этому сеансу.');
      return;
    }
    const whatWasGood =
      state.selectedGood.length > 0
        ? state.selectedGood
            .filter((i) => i >= 0 && i < state.options.length)
            .map((i) => state.options[i])
        : null;
    await this.feedbackRepo.save({
      appointmentId: state.appointmentId,
      rating: state.rating,
      comment: state.comment ?? null,
      whatWasGood,
    });
    feedbackSessions.delete(key);
    await ctx.reply('Спасибо за отзыв!');

    const appointment = await this.appointmentRepo.findOne({
      where: { id: state.appointmentId },
      relations: ['client', 'master'],
    });
    const masterTgId = appointment?.master?.telegramId?.trim();
    if (masterTgId) {
      const clientName = appointment?.client?.name ?? 'Клиент';
      const starsStr = '★'.repeat(state.rating) + '☆'.repeat(5 - state.rating);
      let text = `${clientName} оставил(а) отзыв: ${starsStr}`;
      if (state.comment) text += `\nКомментарий: ${escapeHtml(state.comment)}`;
      if (whatWasGood?.length) text += `\nПонравилось: ${whatWasGood.join(', ')}`;
      await this.sendMessage(masterTgId, text);
    }
  }

  /** Send a message with multiple Web App buttons (e.g. suggested slot times). Up to 2 buttons per row. */
  async sendMessageWithWebAppButtons(
    chatId: string,
    text: string,
    buttons: { label: string; url: string }[],
  ): Promise<boolean> {
    if (!this.bot || !buttons.length) return false;
    try {
      const rows: { text: string; web_app: { url: string } }[][] = [];
      for (let i = 0; i < buttons.length; i += 2) {
        const pair = buttons.slice(i, i + 2).map((b) => ({ text: b.label, web_app: { url: b.url } }));
        rows.push(pair);
      }
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: rows },
      });
      return true;
    } catch (err) {
      console.error('Bot sendMessageWithWebAppButtons error:', err);
      return false;
    }
  }
}
