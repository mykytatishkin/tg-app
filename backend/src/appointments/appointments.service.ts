import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Client } from '../crm/entities/client.entity';
import { Service } from '../crm/entities/service.entity';
import { Appointment, AppointmentSource, AppointmentStatus } from '../crm/entities/appointment.entity';
import { AvailabilitySlot } from '../crm/entities/availability-slot.entity';
import { BookAppointmentDto } from '../crm/dto/book-appointment.dto';
import { BotService } from '../bot/bot.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Service)
    private serviceRepo: Repository<Service>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(AvailabilitySlot)
    private slotRepo: Repository<AvailabilitySlot>,
    private botService: BotService,
  ) {}

  private async getMasterId(): Promise<string> {
    const master = await this.userRepo.findOne({ where: { isMaster: true } });
    if (!master) throw new BadRequestException('No master configured');
    return master.id;
  }

  /** List masters for client booking (id, firstName, lastName). */
  async getMasters(): Promise<{ id: string; firstName: string; lastName: string | null }[]> {
    const masters = await this.userRepo.find({
      where: { isMaster: true },
      select: ['id', 'firstName', 'lastName'],
      order: { firstName: 'ASC' },
    });
    return masters;
  }

  private async resolveMasterId(masterId?: string): Promise<string> {
    if (masterId) {
      const master = await this.userRepo.findOne({ where: { id: masterId, isMaster: true } });
      if (!master) throw new BadRequestException('Master not found');
      return master.id;
    }
    return this.getMasterId();
  }

  async getServices(masterId?: string, forModels?: boolean) {
    const resolved = await this.resolveMasterId(masterId);
    const where: { masterId: string; forModels: boolean } = { masterId: resolved, forModels: forModels === true };
    return this.serviceRepo.find({
      where,
      order: { name: 'ASC' },
    });
  }

  private normalizeUsername(u: string | null | undefined): string {
    if (u == null || typeof u !== 'string') return '';
    return u.replace(/^@/, '').trim().toLowerCase();
  }

  async getMine(user: User) {
    let clients = await this.clientRepo.find({
      where: { telegramId: user.telegramId },
      select: ['id'],
    });
    let clientIds = clients.map((c) => c.id);
    // Если клиент создан мастером вручную без telegramId, но с тем же @username — привязываем по username
    if (clientIds.length === 0 && user.username) {
      const uname = this.normalizeUsername(user.username);
      if (uname) {
        const withoutTg = await this.clientRepo.find({
          where: [{ telegramId: IsNull() }, { telegramId: '' }],
          select: ['id', 'username'],
        });
        const byUsername = withoutTg.filter(
          (c) => this.normalizeUsername(c.username) === uname,
        );
        if (byUsername.length === 1) {
          await this.clientRepo.update(
            { id: byUsername[0].id },
            { telegramId: user.telegramId },
          );
          clientIds = [byUsername[0].id];
        }
      }
    }
    if (clientIds.length === 0) return [];
    return this.appointmentRepo.find({
      where: { clientId: In(clientIds) },
      relations: ['service'],
      order: { date: 'DESC', startTime: 'DESC' },
    });
  }

  /** Get client IDs for current user (by telegramId or username match). */
  private async getMyClientIds(user: User): Promise<string[]> {
    let clients = await this.clientRepo.find({
      where: { telegramId: user.telegramId },
      select: ['id'],
    });
    let clientIds = clients.map((c) => c.id);
    if (clientIds.length === 0 && user.username) {
      const uname = this.normalizeUsername(user.username);
      if (uname) {
        const withoutTg = await this.clientRepo.find({
          where: [{ telegramId: IsNull() }, { telegramId: '' }],
          select: ['id', 'username'],
        });
        const byUsername = withoutTg.filter(
          (c) => this.normalizeUsername(c.username) === uname,
        );
        if (byUsername.length === 1) {
          await this.clientRepo.update(
            { id: byUsername[0].id },
            { telegramId: user.telegramId },
          );
          clientIds = [byUsername[0].id];
        }
      }
    }
    return clientIds;
  }

  /** Get current user's client profile (for editing instagram etc.). Returns null if no client record. */
  async getMyProfile(user: User): Promise<{ name: string; instagram: string | null } | null> {
    const clientIds = await this.getMyClientIds(user);
    if (clientIds.length === 0) return null;
    const client = await this.clientRepo.findOne({
      where: { id: clientIds[0] },
      select: ['name', 'instagram'],
    });
    return client ? { name: client.name, instagram: client.instagram ?? null } : null;
  }

  /** Update current user's instagram in all linked client records. */
  async updateMyProfile(user: User, instagram: string | undefined): Promise<{ name: string; instagram: string | null } | null> {
    const clientIds = await this.getMyClientIds(user);
    if (clientIds.length === 0) return null;
    const value = instagram === undefined ? undefined : (typeof instagram === 'string' ? instagram.trim() || null : null);
    if (value !== undefined) {
      await this.clientRepo.update({ id: In(clientIds) }, { instagram: value });
    }
    return this.getMyProfile(user);
  }

  private toMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  private fromMinutes(m: number): string {
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:00`;
  }

  async getAvailableSlots(date: string, serviceId: string, masterId?: string) {
    const result = await this.getAvailableSlotsForDate(date, serviceId, masterId);
    return result;
  }

  /** Returns free slots for one date. */
  private async getAvailableSlotsForDate(
    date: string,
    serviceId: string,
    masterId?: string,
  ): Promise<{ startTime: string; endTime: string; slotId?: string; priceModifier?: number | null }[]> {
    const resolved = masterId ? await this.resolveMasterId(masterId) : await this.getMasterId();
    const service = await this.serviceRepo.findOne({
      where: { id: serviceId, masterId: resolved },
    });
    if (!service) throw new BadRequestException('Service not found');

    const slots = await this.slotRepo.find({
      where: { masterId: resolved, date, isAvailable: true },
      order: { startTime: 'ASC' },
    });

    const booked = await this.appointmentRepo.find({
      where: { masterId: resolved, date, status: AppointmentStatus.SCHEDULED },
      relations: ['service'],
    });

    const duration = service.durationMinutes;
    const freeSlots: { startTime: string; endTime: string; slotId?: string; priceModifier?: number | null }[] = [];

    for (const slot of slots) {
      if (slot.forModels) continue;
      const modelBooked = booked.some((a) => a.slotId === slot.id && !a.serviceId);
      if (modelBooked) continue;

      let currentMin = this.toMinutes(slot.startTime);
      const slotEndMin = this.toMinutes(slot.endTime);

      while (currentMin + duration <= slotEndMin) {
        const slotStart = this.fromMinutes(currentMin);
        const slotEnd = this.fromMinutes(currentMin + duration);

        const overlaps = booked.some((a) => {
          const aDuration = a.service?.durationMinutes ?? 60;
          const aStart = this.toMinutes(a.startTime);
          const aEnd = aStart + aDuration;
          return currentMin < aEnd && currentMin + duration > aStart;
        });

        if (!overlaps) {
          const modifier = slot.priceModifier != null ? Number(slot.priceModifier) : null;
          freeSlots.push({ startTime: slotStart, endTime: slotEnd, slotId: slot.id, priceModifier: modifier });
        }

        currentMin += 30;
      }
    }

    return freeSlots;
  }

  /** Returns "for models" slots in range: one booking per slot, no service. */
  async getAvailableModelSlotsInRange(
    fromDate: string,
    toDate: string,
    masterId?: string,
  ): Promise<{ date: string; startTime: string; endTime: string; slotId: string }[]> {
    const resolved = masterId ? await this.resolveMasterId(masterId) : await this.getMasterId();
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) return [];

    const slots = await this.slotRepo.find({
      where: { masterId: resolved, isAvailable: true, forModels: true },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    const bookedSlotIds = await this.appointmentRepo
      .createQueryBuilder('a')
      .select('a.slotId')
      .where('a.masterId = :masterId', { masterId: resolved })
      .andWhere('a.status = :status', { status: AppointmentStatus.SCHEDULED })
      .andWhere('a.slotId IS NOT NULL')
      .andWhere('a.date >= :from', { from: fromDate })
      .andWhere('a.date <= :to', { to: toDate })
      .getRawMany()
      .then((rows) => new Set(rows.map((r) => r.a_slotId).filter(Boolean)));

    const result: { date: string; startTime: string; endTime: string; slotId: string; priceModifier?: number | null }[] = [];
    for (const slot of slots) {
      if (slot.date < fromDate || slot.date > toDate) continue;
      if (bookedSlotIds.has(slot.id)) continue;
      const modifier = slot.priceModifier != null ? Number(slot.priceModifier) : null;
      result.push({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotId: slot.id,
        priceModifier: modifier,
      });
    }
    return result;
  }

  /** Returns all available slots in a date range (for client booking: choose from master's options only). */
  async getAvailableSlotsInRange(
    serviceId: string,
    fromDate: string,
    toDate: string,
    masterId?: string,
  ): Promise<{ date: string; startTime: string; endTime: string; slotId?: string; priceModifier?: number | null }[]> {
    const resolved = masterId ? await this.resolveMasterId(masterId) : await this.getMasterId();
    const service = await this.serviceRepo.findOne({
      where: { id: serviceId, masterId: resolved },
    });
    if (!service) throw new BadRequestException('Service not found');

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) return [];

    const result: { date: string; startTime: string; endTime: string; slotId?: string; priceModifier?: number | null }[] = [];
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);

    while (current <= to) {
      const dateStr = current.toISOString().slice(0, 10);
      const daySlots = await this.getAvailableSlotsForDate(dateStr, serviceId, resolved);
      for (const s of daySlots) {
        result.push({ date: dateStr, startTime: s.startTime, endTime: s.endTime, slotId: s.slotId, priceModifier: s.priceModifier });
      }
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  async book(user: User, dto: BookAppointmentDto) {
    const masterId = await this.resolveMasterId(dto.masterId);

    let client = await this.clientRepo.findOne({
      where: { telegramId: user.telegramId, masterId },
    });
    if (!client) {
      client = this.clientRepo.create({
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        telegramId: user.telegramId,
        username: user.username ?? null,
        masterId,
      });
      await this.clientRepo.save(client);
    }

    const slot = dto.slotId
      ? await this.slotRepo.findOne({ where: { id: dto.slotId, masterId } })
      : null;
    const isForModels = slot?.forModels === true;
    if (isForModels) {
      if (!dto.slotId) throw new BadRequestException('slotId is required for model booking');
      const alreadyBooked = await this.appointmentRepo.findOne({
        where: { slotId: dto.slotId, status: AppointmentStatus.SCHEDULED },
      });
      if (alreadyBooked) throw new BadRequestException('This slot is already booked');
      let serviceId: string | null = null;
      if (dto.serviceId) {
        const service = await this.serviceRepo.findOne({
          where: { id: dto.serviceId, masterId, forModels: true },
        });
        if (!service) throw new BadRequestException('Service not found or not for models');
        serviceId = service.id;
      }
      const appointment = this.appointmentRepo.create({
        clientId: client.id,
        serviceId,
        slotId: dto.slotId,
        date: dto.date,
        startTime: dto.startTime,
        masterId,
        status: AppointmentStatus.SCHEDULED,
        source: AppointmentSource.SELF,
        note: dto.note ?? null,
        referenceImageUrl: dto.referenceImageUrl ?? null,
        reminderEnabled: true,
      });
      return this.appointmentRepo.save(appointment);
    }

    const service = await this.serviceRepo.findOne({
      where: { id: dto.serviceId, masterId },
    });
    if (!service) throw new BadRequestException('Service not found');

    const appointment = this.appointmentRepo.create({
      clientId: client.id,
      serviceId: service.id,
      slotId: dto.slotId ?? null,
      date: dto.date,
      startTime: dto.startTime,
      masterId,
      status: AppointmentStatus.SCHEDULED,
      source: AppointmentSource.SELF,
      note: dto.note ?? null,
      referenceImageUrl: dto.referenceImageUrl ?? null,
      reminderEnabled: true,
    });
    return this.appointmentRepo.save(appointment);
  }

  async setReminder(user: User, appointmentId: string, enable: boolean) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['client', 'master'],
    });
    if (!appointment) throw new BadRequestException('Appointment not found');
    const isClient = appointment.client?.telegramId === user.telegramId;
    const isMaster = appointment.masterId === user.id;
    if (!isClient && !isMaster) throw new ForbiddenException('Not your appointment');
    appointment.reminderEnabled = enable;
    return this.appointmentRepo.save(appointment);
  }

  /** Client cancels their own appointment. */
  async cancelByClient(user: User, appointmentId: string, reason: string) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['client', 'master', 'service'],
    });
    if (!appointment) throw new BadRequestException('Appointment not found');
    if (appointment.client?.telegramId !== user.telegramId) {
      throw new ForbiddenException('Only the client who booked can cancel');
    }
    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException('Appointment cannot be cancelled');
    }
    const reasonText = (reason && String(reason).trim()) || 'Не указана';
    appointment.status = AppointmentStatus.CANCELLED;
    (appointment as { cancellationReason?: string; cancelledBy?: 'client' | 'master' }).cancellationReason = reasonText;
    (appointment as { cancellationReason?: string; cancelledBy?: 'client' | 'master' }).cancelledBy = 'client';
    const saved = await this.appointmentRepo.save(appointment);

    const masterTgId = appointment.master?.telegramId?.trim();
    if (masterTgId) {
      const dateStr = typeof appointment.date === 'string' ? appointment.date : (appointment.date as Date).toISOString().slice(0, 10);
      const timeStr = (appointment.startTime || '').slice(0, 5);
      const clientName = appointment.client?.name ?? 'Клиент';
      const clientUsername = appointment.client?.username?.trim();
      const mention = clientUsername ? `@${clientUsername}` : clientName;
      const serviceName = appointment.service?.name ?? '';
      const text = `❌ Клиент отменил запись: ${dateStr} ${timeStr}${serviceName ? `, ${serviceName}` : ''}. Клиент: ${mention}. Причина: ${reasonText}`;
      await this.botService.sendMessage(masterTgId, text);
    }

    return saved;
  }
}
