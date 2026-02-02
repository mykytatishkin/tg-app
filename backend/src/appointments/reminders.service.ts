import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Appointment, AppointmentStatus } from '../crm/entities/appointment.entity';
import { BotService } from '../bot/bot.service';

const INTERVAL_MS = 15 * 60 * 1000; // 15 min
const REMINDER_WINDOW_HOURS = 24;

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    private botService: BotService,
  ) {}

  onModuleInit() {
    this.sendDueReminders().catch((err) => console.error('RemindersService init run error:', err));
    this.intervalId = setInterval(() => {
      this.sendDueReminders().catch((err) => console.error('RemindersService interval error:', err));
    }, INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private toAppointmentDateTime(date: string | Date, startTime: string): Date {
    const dateStr = typeof date === 'string' ? date : (date as Date).toISOString().slice(0, 10);
    const timeStr = String(startTime ?? '').trim();
    const timeNormalized = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    return new Date(`${dateStr}T${timeNormalized}`);
  }

  private async sendDueReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000);

    const appointments = await this.appointmentRepo.find({
      where: {
        status: AppointmentStatus.SCHEDULED,
        reminderEnabled: true,
        reminderSentAt: IsNull(),
      },
      relations: ['client', 'master', 'service'],
    });

    for (const a of appointments) {
      const appointmentDateTime = this.toAppointmentDateTime(a.date, a.startTime);
      if (appointmentDateTime <= now) continue;
      if (appointmentDateTime > windowEnd) continue;

      const dateStr = typeof a.date === 'string' ? a.date : (a.date as Date).toISOString().slice(0, 10);
      const timeStr = (a.startTime || '').slice(0, 5);
      const dateTimeStr = `${dateStr} ${timeStr}`;
      const serviceName = a.service?.name ?? '';
      const clientName = a.client?.name ?? 'Client';
      const masterName = a.master ? `${a.master.firstName} ${a.master.lastName || ''}`.trim() : 'Master';
      const clientTgId = a.client?.telegramId?.trim() || null;
      const masterTgId = a.master?.telegramId?.trim() || null;

      if (clientTgId) {
        const linkToMaster = masterTgId
          ? `<a href="tg://user?id=${masterTgId}">${escapeHtml(masterName)}</a>`
          : masterName;
        const text = `⏰ Напоминание о записи: ${dateTimeStr}${serviceName ? `, ${serviceName}` : ''}. Мастер: ${linkToMaster}`;
        await this.botService.sendMessage(clientTgId, text);
      }
      if (masterTgId) {
        const linkToClient = clientTgId
          ? `<a href="tg://user?id=${clientTgId}">${escapeHtml(clientName)}</a>`
          : clientName;
        const text = `⏰ Напоминание о записи: ${dateTimeStr}${serviceName ? `, ${serviceName}` : ''}. Клиент: ${linkToClient}`;
        await this.botService.sendMessage(masterTgId, text);
      }

      a.reminderSentAt = new Date();
      await this.appointmentRepo.save(a);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
