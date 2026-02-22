import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThanOrEqual } from 'typeorm';
import {
  Appointment,
  AppointmentStatus,
} from '../crm/entities/appointment.entity';
import { BotService } from '../bot/bot.service';
import { parseDateTimeInVilnius } from '../shared/timezone.util';

const INTERVAL_MS = 5 * 60 * 1000; // 5 min
const MAX_AGE_DAYS = 30; // don't ask about appointments older than 30 days
const BATCH_DELAY_MS = 500; // pause between messages to avoid Telegram rate limits

@Injectable()
export class PostSessionService implements OnModuleInit, OnModuleDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    private botService: BotService,
  ) {}

  onModuleInit() {
    this.check().catch((err) =>
      console.error('PostSessionService init error:', err),
    );
    this.intervalId = setInterval(() => {
      this.check().catch((err) =>
        console.error('PostSessionService interval error:', err),
      );
    }, INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async check() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
    const cutoffDateStr = cutoff.toISOString().slice(0, 10);

    const appointments = await this.appointmentRepo.find({
      where: {
        status: AppointmentStatus.SCHEDULED,
        postSessionSentAt: IsNull(),
        date: MoreThanOrEqual(cutoffDateStr),
      },
      relations: ['client', 'master', 'service'],
      order: { date: 'ASC', startTime: 'ASC' },
    });

    for (const a of appointments) {
      const duration = a.service?.durationMinutes ?? 60;
      const start = parseDateTimeInVilnius(a.date, a.startTime);
      const end = new Date(start.getTime() + duration * 60 * 1000);

      if (end >= now) continue;

      const masterTgId = a.master?.telegramId?.trim();
      if (!masterTgId) continue;

      const sent = await this.botService.sendPostSessionQuestion(
        masterTgId,
        a.id,
        a.client?.name ?? 'Клиент',
        a.date,
        a.startTime,
        a.service?.name ?? null,
      );

      if (sent) {
        a.postSessionSentAt = new Date();
        await this.appointmentRepo.save(a);
      }

      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
}
