import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { BotService } from '../bot/bot.service';

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 h
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class ClientRemindersService implements OnModuleInit, OnModuleDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
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
    const appUrl = this.configService.get<string>('MINI_APP_URL');
    const bookingUrl = appUrl ? `${appUrl.replace(/\/$/, '')}/appointments/book` : '';

    for (const client of clients) {
      if (!client.telegramId?.trim()) continue;

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
      const lastVisitMs = new Date(`${lastDone.date}T${lastDone.startTime}`).getTime();
      if (lastVisitMs + TWO_WEEKS_MS > now) continue;

      if (client.lastReminderSentAt && client.lastReminderSentAt.getTime() >= lastVisitMs) continue;

      const text = `👋 ${client.name || 'Добрый день'}! Прошло уже 2 недели с последнего визита — пора обновить маникюр или записаться на любимую процедуру. Ждём вас!`;
      if (bookingUrl) {
        await this.botService.sendMessageWithWebAppButton(
          client.telegramId.trim(),
          text,
          'Записаться',
          bookingUrl,
        );
      } else {
        await this.botService.sendMessage(client.telegramId.trim(), text);
      }
      await this.clientRepo.update({ id: client.id }, { lastReminderSentAt: new Date() });
    }
  }
}
