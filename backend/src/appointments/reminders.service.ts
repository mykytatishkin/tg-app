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
    this.intervalId = setInterval(() => this.sendDueReminders(), INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
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
      const appointmentDateTime = new Date(`${a.date}T${a.startTime}`);
      // Send if appointment is in the past OR within next 24h (even if time has passed, still send reminder)
      if (appointmentDateTime > windowEnd) continue;

      const dateTimeStr = `${a.date} ${a.startTime}`;
      const serviceName = a.service?.name ?? '';

      const clientName = a.client?.name ?? 'Client';
      const masterName = a.master ? `${a.master.firstName} ${a.master.lastName || ''}`.trim() : 'Master';
      const clientTgId = a.client?.telegramId;
      const masterTgId = a.master?.telegramId;

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
