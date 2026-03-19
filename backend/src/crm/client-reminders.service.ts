import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { User } from '../auth/entities/user.entity';
import { BotService } from '../bot/bot.service';
import { getTodayInVilnius } from '../shared/timezone.util';
import { getClickableAddressHtml } from '../shared/maps.util';

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 h
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000; // 14 суток
const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000; // 21 суток
const SLOTS_DAYS_AHEAD = 14;
const MAX_SUGGESTED_SLOTS = 5;
const MIN_GAP_BETWEEN_REMINDERS_MS = 23 * 60 * 60 * 1000; // не слать чаще раза в 23 ч

const WEEKDAY_NAMES_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const VILNIUS_TIMEZONE = 'Europe/Vilnius';

type TimeBucket = 'morning' | 'afternoon' | 'evening';
function getTimeBucket(startTime: string): TimeBucket {
  const hour = parseInt(String(startTime).slice(0, 2), 10) || 0;
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function formatSlotLabelRu(dateStr: string, startTime: string): string {
  // Создаем дату в полдень чтобы избежать проблем с часовым поясом
  const dateTime = new Date(dateStr + 'T12:00:00Z');
  
  // Форматируем дату в часовом поясе Вильнюса
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: VILNIUS_TIMEZONE,
  });
  
  const datePart = formatter.format(dateTime).replace('.', '');
  const time = String(startTime).slice(0, 5);
  return `${datePart}, ${time}`;
}

@Injectable()
export class ClientRemindersService implements OnModuleInit, OnModuleDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(AvailabilitySlot)
    private slotRepo: Repository<AvailabilitySlot>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private botService: BotService,
    private configService: ConfigService,
  ) {}

  onModuleInit() {
    this.sendDueReminders().catch((err) => console.error('ClientRemindersService init error:', err));
    this.intervalId = setInterval(() => {
      this.sendDueReminders().catch((err) => console.error('ClientRemindersService interval error:', err));
    }, INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async sendDueReminders() {
    const clients = await this.clientRepo.find({
      where: {},
      select: ['id', 'name', 'telegramId', 'masterId', 'lastReminderSentAt'],
    });
    const now = Date.now();
    const todayStr = getTodayInVilnius();
    const appUrl = this.configService.get<string>('MINI_APP_URL');
    const bookingBaseUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/appointments/book` : '';
    const sentToTelegramIdsThisRun = new Set<string>();

    for (const client of clients) {
      const tgId = client.telegramId?.trim();
      if (!tgId) continue;
      if (sentToTelegramIdsThisRun.has(tgId)) continue;

      const lastDone = await this.appointmentRepo
        .createQueryBuilder('a')
        .select('a.date', 'date')
        .addSelect('a.startTime', 'startTime')
        .where('a.clientId = :clientId', { clientId: client.id })
        .andWhere('a.status = :status', { status: AppointmentStatus.DONE })
        .orderBy('a.date', 'DESC')
        .addOrderBy('a.startTime', 'DESC')
        .limit(1)
        .getRawOne();

      if (!lastDone) continue;

      const dateStr = typeof lastDone.date === 'string' ? lastDone.date : (lastDone.date as Date)?.toISOString?.()?.slice(0, 10);
      if (!dateStr) continue;
      const lastVisitEndOfDay = new Date(`${dateStr}T23:59:59.999`).getTime();
      if (Number.isNaN(lastVisitEndOfDay) || lastVisitEndOfDay > now) continue;

      if (lastVisitEndOfDay + TWO_WEEKS_MS > now) continue;

      if (client.lastReminderSentAt) {
        const sentAt = client.lastReminderSentAt.getTime();
        if (sentAt >= lastVisitEndOfDay && now - sentAt < MIN_GAP_BETWEEN_REMINDERS_MS) continue;
      }

      const isThreeWeeksOrMore = lastVisitEndOfDay + THREE_WEEKS_MS <= now;

      const master = await this.userRepo.findOne({
        where: { id: client.masterId },
        select: ['address'],
      });
      const masterAddress = master?.address?.trim() || '';

      if (isThreeWeeksOrMore && bookingBaseUrl) {
        const sent = await this.sendSmartReminderWithSlots(client, bookingBaseUrl, masterAddress);
        if (sent) {
          await this.clientRepo.update({ id: client.id }, { lastReminderSentAt: new Date() });
          sentToTelegramIdsThisRun.add(tgId);
        }
      } else {
        const addressPart = masterAddress ? ` Ждём вас по адресу:${getClickableAddressHtml(masterAddress)}` : ' Ждём вас!';
        const text = `приветик, ${client.name || 'приветик'}!! напоминаю, что пришло время записаться на ноготочки💓 
сейчас как раз у тебя есть шанс выиграть 40€, угадав пароль от сейфа
шанс выйграть с каждым днем увеличивается 🙈${addressPart}`;
        const sent = bookingBaseUrl
          ? await this.botService.sendMessageWithWebAppButton(tgId, text, 'Записаться', bookingBaseUrl)
          : await this.botService.sendMessage(tgId, text);
        if (sent) {
          await this.clientRepo.update({ id: client.id }, { lastReminderSentAt: new Date() });
          sentToTelegramIdsThisRun.add(tgId);
        }
      }
    }
  }

  /** For clients 3+ weeks without visit: suggest slots matching their past weekday/time preferences. */
  private async sendSmartReminderWithSlots(
    client: { id: string; name: string | null; telegramId: string | null; masterId: string },
    bookingBaseUrl: string,
    masterAddress?: string,
  ): Promise<boolean> {
    const tgId = client.telegramId?.trim();
    if (!tgId) return false;

    const todayStr = getTodayInVilnius();

    // Check user's manual preferences first
    const user = client.telegramId
      ? await this.userRepo.findOne({ where: { telegramId: client.telegramId } })
      : null;
    const manualDays = Array.isArray(user?.favoriteDays) && user.favoriteDays.length > 0 ? user.favoriteDays : null;
    const manualBuckets = Array.isArray(user?.favoriteTimeBuckets) && user.favoriteTimeBuckets.length > 0
      ? (user.favoriteTimeBuckets as TimeBucket[])
      : null;

    const preferredWeekdays = new Set<number>();
    const preferredTimeBuckets = new Set<TimeBucket>();

    if (manualDays || manualBuckets) {
      if (manualDays) manualDays.forEach((d) => preferredWeekdays.add(d));
      if (manualBuckets) manualBuckets.forEach((b) => preferredTimeBuckets.add(b));
    } else {
      const pastAppointments = await this.appointmentRepo
        .createQueryBuilder('a')
        .select('a.date', 'date')
        .addSelect('a.startTime', 'startTime')
        .where('a.clientId = :clientId', { clientId: client.id })
        .andWhere('a.status = :status', { status: AppointmentStatus.DONE })
        .orderBy('a.date', 'DESC')
        .limit(20)
        .getRawMany();

      for (const a of pastAppointments) {
        const dStr = typeof a.date === 'string' ? a.date : (a.date as Date)?.toISOString?.()?.slice(0, 10);
        if (dStr) preferredWeekdays.add(new Date(dStr + 'T12:00:00').getDay());
        if (a.startTime) preferredTimeBuckets.add(getTimeBucket(String(a.startTime)));
      }
    }

    const toDate = new Date();
    toDate.setDate(toDate.getDate() + SLOTS_DAYS_AHEAD);
    const toStr = toDate.toISOString().slice(0, 10);

    const slots = await this.slotRepo
      .createQueryBuilder('s')
      .where('s.masterId = :masterId', { masterId: client.masterId })
      .andWhere('s.isAvailable = :available', { available: true })
      .andWhere('s.forModels = :forModels', { forModels: false })
      .andWhere('s.date >= :from', { from: todayStr })
      .andWhere('s.date <= :to', { to: toStr })
      .orderBy('s.date', 'ASC')
      .addOrderBy('s.startTime', 'ASC')
      .getMany();

    const seen = new Set<string>();
    const buttons: { label: string; url: string }[] = [];
    for (const slot of slots) {
      if (buttons.length >= MAX_SUGGESTED_SLOTS) break;
      const slotDate = typeof slot.date === 'string' ? slot.date : (slot.date as Date)?.toISOString?.()?.slice(0, 10);
      if (!slotDate) continue;
      const key = `${slotDate}_${slot.startTime}`;
      if (seen.has(key)) continue;
      const weekday = new Date(slotDate + 'T12:00:00').getDay();
      const bucket = getTimeBucket(slot.startTime);
      const matches = preferredWeekdays.has(weekday) || preferredTimeBuckets.has(bucket);
      if (!matches) continue;
      seen.add(key);
      const label = formatSlotLabelRu(slotDate, slot.startTime);
      const url = `${bookingBaseUrl}?date=${encodeURIComponent(slotDate)}&masterId=${encodeURIComponent(client.masterId)}`;
      buttons.push({ label, url });
    }

    let text = `приветик! напоминаю, что пришло время записаться на ноготочки💓 
сейчас как раз у тебя есть шанс выиграть 40€, угадав пароль от сейфа
шанс выйграть с каждым днем увеличивается 🙈`;
    if (masterAddress) text += ` Адрес:${getClickableAddressHtml(masterAddress)}`;

    if (buttons.length > 0) {
      return this.botService.sendMessageWithWebAppButtons(tgId, text, buttons);
    }
    return this.botService.sendMessageWithWebAppButton(tgId, text, 'Записаться', bookingBaseUrl);
  }

  /** Send "14-day" style reminder to a client (one button "Записаться"). Called by master from UI. */
  async sendSimpleReminderToClient(client: {
    id: string;
    name: string | null;
    telegramId: string | null;
    masterId: string;
  }): Promise<boolean> {
    const tgId = client.telegramId?.trim();
    if (!tgId) return false;
    const master = await this.userRepo.findOne({
      where: { id: client.masterId },
      select: ['address'],
    });
    const masterAddress = master?.address?.trim() || '';
    const appUrl = this.configService.get<string>('MINI_APP_URL');
    const bookingUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/appointments/book` : '';
    let text = `приветик! напоминаю, что пришло время записаться на ноготочки💓 
сейчас как раз у тебя есть шанс выиграть 40€, угадав пароль от сейфа
шанс выйграть с каждым днем увеличивается 🙈`;
    if (masterAddress) text += ` Адрес:${getClickableAddressHtml(masterAddress)}`;
    if (bookingUrl) {
      return this.botService.sendMessageWithWebAppButton(tgId, text, 'Записаться', bookingUrl);
    }
    return this.botService.sendMessage(tgId, text);
  }

  /** Send "21-day" style reminder with suggested slots. Called by master from UI. */
  async sendSmartReminderToClient(client: {
    id: string;
    name: string | null;
    telegramId: string | null;
    masterId: string;
  }): Promise<boolean> {
    const appUrl = this.configService.get<string>('MINI_APP_URL');
    const bookingBaseUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/appointments/book` : '';
    if (!bookingBaseUrl) return false;
    const master = await this.userRepo.findOne({
      where: { id: client.masterId },
      select: ['address'],
    });
    const masterAddress = master?.address?.trim() || '';
    return this.sendSmartReminderWithSlots(client, bookingBaseUrl, masterAddress);
  }
}
