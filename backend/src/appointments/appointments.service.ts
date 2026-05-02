import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThan, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Client } from '../crm/entities/client.entity';
import { Service } from '../crm/entities/service.entity';
import { Appointment, AppointmentSource, AppointmentStatus, PaymentStatus } from '../crm/entities/appointment.entity';
import { AppointmentFeedback } from '../crm/entities/appointment-feedback.entity';
import { AvailabilitySlot } from '../crm/entities/availability-slot.entity';
import { BookAppointmentDto } from '../crm/dto/book-appointment.dto';
import { BotService } from '../bot/bot.service';
import { getTodayInVilnius, parseDateTimeInVilnius, formatDateTimeForNotification } from '../shared/timezone.util';
import { getGoogleMapsUrl } from '../shared/maps.util';

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
    @InjectRepository(AppointmentFeedback)
    private feedbackRepo: Repository<AppointmentFeedback>,
    @InjectRepository(AvailabilitySlot)
    private slotRepo: Repository<AvailabilitySlot>,
    private botService: BotService,
    private configService: ConfigService,
  ) {}

  private async getMasterId(): Promise<string> {
    const master = await this.userRepo.findOne({ where: { isMaster: true } });
    if (!master) throw new BadRequestException('No master configured');
    return master.id;
  }

  /** List masters for client booking (id, firstName, lastName, address). */
  async getMasters(): Promise<{ id: string; firstName: string; lastName: string | null; address: string | null }[]> {
    const masters = await this.userRepo.find({
      where: { isMaster: true },
      select: ['id', 'firstName', 'lastName', 'address'],
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
      relations: ['service', 'feedback'],
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
  async getMyProfile(user: User) {
    const clientIds = await this.getMyClientIds(user);
    if (clientIds.length === 0) return null;
    const client = await this.clientRepo.findOne({
      where: { id: clientIds[0] },
      select: ['name', 'instagram'],
    });
    if (!client) return null;
    const freshUser = await this.userRepo.findOne({ where: { id: user.id } });
    return {
      name: client.name,
      instagram: client.instagram ?? null,
      favoriteDays: freshUser?.favoriteDays ?? null,
      favoriteTimeBuckets: freshUser?.favoriteTimeBuckets ?? null,
    };
  }

  /** Client-side stats: total spent per master + per service. */
  async getMyStats(user: User) {
    const clients = await this.clientRepo.find({
      where: { telegramId: user.telegramId },
      relations: ['appointments', 'appointments.service', 'master'],
    });
    if (clients.length === 0) return { totalSpent: 0, byMaster: [] };

    let totalSpent = 0;
    const byMaster: {
      masterName: string;
      totalSpent: number;
      appointmentCount: number;
      byService: { name: string; total: number }[];
    }[] = [];

    for (const c of clients) {
      const doneAppts = (c.appointments || []).filter(
        (a) => a.status === AppointmentStatus.DONE,
      );
      let masterTotal = 0;
      const svcMap = new Map<string, { name: string; total: number }>();
      for (const a of doneAppts) {
        const price =
          a.finalPrice != null
            ? Number(a.finalPrice)
            : a.service?.price != null
              ? Number(a.service.price)
              : 0;
        masterTotal += price;
        const sName = a.service?.name ?? 'Прочее';
        const sid = a.serviceId ?? '__none__';
        if (!svcMap.has(sid)) svcMap.set(sid, { name: sName, total: 0 });
        svcMap.get(sid)!.total += price;
      }
      totalSpent += masterTotal;
      const masterName = c.master
        ? [c.master.firstName, c.master.lastName].filter(Boolean).join(' ').trim() || 'Мастер'
        : 'Мастер';
      byMaster.push({
        masterName,
        totalSpent: Math.round(masterTotal * 100) / 100,
        appointmentCount: doneAppts.length,
        byService: Array.from(svcMap.values())
          .map((s) => ({ ...s, total: Math.round(s.total * 100) / 100 }))
          .sort((a, b) => b.total - a.total),
      });
    }

    return {
      totalSpent: Math.round(totalSpent * 100) / 100,
      byMaster: byMaster.sort((a, b) => b.totalSpent - a.totalSpent),
    };
  }

  /** Update current user's profile: instagram + favorite days/time. */
  async updateMyProfile(
    user: User,
    body: { instagram?: string; favoriteDays?: number[]; favoriteTimeBuckets?: string[] },
  ) {
    const clientIds = await this.getMyClientIds(user);
    if (clientIds.length === 0) return null;
    const igValue = body.instagram === undefined ? undefined : (typeof body.instagram === 'string' ? body.instagram.trim() || null : null);
    if (igValue !== undefined) {
      await this.clientRepo.update({ id: In(clientIds) }, { instagram: igValue });
    }
    const userUpdate: Partial<User> = {};
    if (body.favoriteDays !== undefined) {
      userUpdate.favoriteDays = Array.isArray(body.favoriteDays) ? body.favoriteDays : null;
    }
    if (body.favoriteTimeBuckets !== undefined) {
      userUpdate.favoriteTimeBuckets = Array.isArray(body.favoriteTimeBuckets) ? body.favoriteTimeBuckets : null;
    }
    if (Object.keys(userUpdate).length > 0) {
      await this.userRepo.update({ id: user.id }, userUpdate);
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
    const todayStr = getTodayInVilnius();
    if (date < todayStr) return [];
    const result = await this.getAvailableSlotsForDate(date, serviceId, masterId);
    return result;
  }

  /** Returns free slots for one date. */
  private async getAvailableSlotsForDate(
    date: string,
    serviceId: string,
    masterId?: string,
  ): Promise<{ startTime: string; endTime: string; slotId?: string; priceModifier?: number | null }[]> {
    const todayStr = getTodayInVilnius();
    if (date < todayStr) return [];

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
    const now = new Date();
    const isToday = date === todayStr;

    for (const slot of slots) {
      if (slot.forModels) continue;
      const modelBooked = booked.some((a) => a.slotId === slot.id && !a.serviceId);
      if (modelBooked) continue;

      let currentMin = this.toMinutes(slot.startTime);
      const slotEndMin = this.toMinutes(slot.endTime);

      while (currentMin + duration <= slotEndMin) {
        const slotStart = this.fromMinutes(currentMin);
        const slotEnd = this.fromMinutes(currentMin + duration);

        if (isToday && parseDateTimeInVilnius(date, slotStart) <= now) {
          currentMin += 30;
          continue;
        }

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

  /** Normalize date to YYYY-MM-DD for reliable range comparison (DB may return Date or ISO string). */
  private toDateOnly(value: string | Date): string {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(value);
    return s.slice(0, 10);
  }

  /** Returns "for models" slots in range: one booking per slot, service fixed by master. */
  async getAvailableModelSlotsInRange(
    fromDate: string,
    toDate: string,
    masterId?: string,
  ): Promise<{ date: string; startTime: string; endTime: string; slotId: string; priceModifier?: number | null; serviceId?: string; serviceName?: string }[]> {
    const resolved = masterId ? await this.resolveMasterId(masterId) : await this.getMasterId();
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) return [];

    const fromNorm = this.toDateOnly(fromDate);
    const toNorm = this.toDateOnly(toDate);

    const slots = await this.slotRepo.find({
      where: { masterId: resolved, isAvailable: true, forModels: true },
      relations: ['service'],
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

    const now = new Date();
    const todayStr = getTodayInVilnius();
    const result: { date: string; startTime: string; endTime: string; slotId: string; priceModifier?: number | null; serviceId?: string; serviceName?: string }[] = [];
    for (const slot of slots) {
      const slotDateNorm = this.toDateOnly(slot.date);
      if (slotDateNorm < fromNorm || slotDateNorm > toNorm) continue;
      if (slotDateNorm < todayStr) continue;
      if (slotDateNorm === todayStr && parseDateTimeInVilnius(slotDateNorm, slot.startTime) <= now) continue;
      if (bookedSlotIds.has(slot.id)) continue;
      if (!slot.serviceId) continue;
      const modifier = slot.priceModifier != null ? Number(slot.priceModifier) : null;
      const service = slot.service;
      result.push({
        date: slotDateNorm,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotId: slot.id,
        priceModifier: modifier,
        serviceId: slot.serviceId ?? undefined,
        serviceName: service?.name ?? undefined,
      });
    }
    return result;
  }

  /** Returns slots with discount price (priceModifier < 0) for clients — for display on Promo page. */
  async getDiscountSlots(
    fromDate: string,
    toDate: string,
  ): Promise<{ date: string; startTime: string; endTime: string; priceModifier: number }[]> {
    const masterId = await this.getMasterId();
    const slots = await this.slotRepo.find({
      where: {
        masterId,
        isAvailable: true,
        forModels: false,
        date: Between(fromDate, toDate),
        priceModifier: LessThan(0),
      },
      select: ['date', 'startTime', 'endTime', 'priceModifier'],
      order: { date: 'ASC', startTime: 'ASC' },
    });
    return slots.map((s) => ({
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      priceModifier: Number(s.priceModifier),
    }));
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

    const todayStr = getTodayInVilnius();
    const effectiveFrom = fromDate < todayStr ? todayStr : fromDate;
    const from = new Date(effectiveFrom);
    const to = new Date(toDate);
    if (from > to) return [];

    const result: { date: string; startTime: string; endTime: string; slotId?: string; priceModifier?: number | null }[] = [];
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);

    while (current <= to) {
      const dateStr = current.toISOString().slice(0, 10);
      if (dateStr >= todayStr) {
        const daySlots = await this.getAvailableSlotsForDate(dateStr, serviceId, resolved);
        for (const s of daySlots) {
          result.push({ date: dateStr, startTime: s.startTime, endTime: s.endTime, slotId: s.slotId, priceModifier: s.priceModifier });
        }
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
      // Use service from slot (master's choice), client cannot change it
      const serviceId = slot?.serviceId ?? null;
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
        paymentStatus: PaymentStatus.PENDING,
      });
      const saved = await this.appointmentRepo.save(appointment);
      const serviceForSlot = slot.serviceId ? await this.serviceRepo.findOne({ where: { id: slot.serviceId } }) : null;
      await this.notifyMasterOnNewBooking(masterId, client, saved, serviceForSlot?.name ?? null);
      await this.notifyClientOnBooking(client, saved, serviceForSlot?.name ?? null, masterId);
      if (serviceForSlot) {
        await this.maybeNotifyMasterDayFull(masterId, dto.date, serviceForSlot.id);
      }
      return saved;
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
      paymentStatus: PaymentStatus.PENDING,
    });
    const saved = await this.appointmentRepo.save(appointment);
    await this.notifyMasterOnNewBooking(masterId, client, saved, service.name);
    await this.notifyClientOnBooking(client, saved, service.name, masterId);
    await this.maybeNotifyMasterDayFull(masterId, dto.date, service.id);
    return saved;
  }

  /** Notify client in Telegram: confirmation with address and calendar buttons. */
  private async notifyClientOnBooking(
    client: Client,
    appointment: Appointment,
    serviceName: string | null,
    masterId: string,
  ): Promise<void> {
    const clientTgId = client.telegramId?.trim();
    if (!clientTgId) return;

    const master = await this.userRepo.findOne({ where: { id: masterId }, select: ['address'] });
    const masterAddress = master?.address?.trim() || '';
    const dateTimeStr = formatDateTimeForNotification(appointment.date, appointment.startTime);
    const servicePart = serviceName ? `, ${serviceName}` : '';
    let text = `✅ Вы записаны на ${dateTimeStr}${servicePart}.`;
    if (masterAddress) {
      text += ` Адрес: ${this.escapeHtml(masterAddress)}`;
    }

    const buttons: { label: string; url: string }[] = [];
    if (masterAddress) {
      buttons.push({ label: '📍 Адрес', url: getGoogleMapsUrl(masterAddress) });
    }
    const start = parseDateTimeInVilnius(appointment.date, appointment.startTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const formatForCalendar = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '').slice(0, 15) + 'Z';
    let calendarUrl =
      'https://www.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(serviceName ? `Запись: ${serviceName}` : 'Запись')}` +
      `&dates=${formatForCalendar(start)}/${formatForCalendar(end)}`;
    if (masterAddress) {
      calendarUrl += `&details=${encodeURIComponent(masterAddress)}`;
    }
    buttons.push({ label: '📅 Синхронизировать календарь', url: calendarUrl });

    await this.botService.sendMessageWithUrlButtons(clientTgId, text, buttons);
  }

  /** Notify master in Telegram about a new booking (client self-service). */
  private async notifyMasterOnNewBooking(
    masterId: string,
    client: Client,
    appointment: Appointment,
    serviceName: string | null,
  ): Promise<void> {
    const master = await this.userRepo.findOne({ where: { id: masterId }, select: ['telegramId'] });
    const masterTgId = master?.telegramId?.trim();
    if (!masterTgId) {
      console.warn(
        `[notifyMasterOnNewBooking] Master ${masterId} has no telegramId in users table — notification skipped. Master must open the bot/mini-app once so their Telegram ID is saved.`,
      );
      return;
    }
    const dateStr = typeof appointment.date === 'string' ? appointment.date : (appointment.date as Date)?.toISOString?.()?.slice(0, 10);
    const timeStr = (appointment.startTime || '').slice(0, 5);
    const clientName = client.name ?? 'Клиент';
    const clientUsername = client.username?.trim();
    const clientTgId = client.telegramId?.trim();
    const mention = clientTgId
      ? `<a href="tg://user?id=${clientTgId}">${this.escapeHtml(clientName)}</a>`
      : clientUsername
        ? `@${clientUsername}`
        : this.escapeHtml(clientName);
    const servicePart = serviceName ? `, ${this.escapeHtml(serviceName)}` : '';
    const noShowPart = (client.noShowCount ?? 0) > 0
      ? `\n⚠️ Пропусков без отмены: ${client.noShowCount}${client.noShowCount > 2 ? ' (ненадёжный клиент)' : ''}`
      : '';
    const text = `📅 Новая запись: ${dateStr} ${timeStr}${servicePart}. Клиент: ${mention}${noShowPart}`;
    const sent = await this.botService.sendMessage(masterTgId, text);
    if (!sent) {
      console.warn(`[notifyMasterOnNewBooking] Failed to send Telegram message to master chat_id=${masterTgId}. Check logs above for Bot sendMessage error.`);
    }
  }

  /** If there are no free slots left for this service on this date, send master a summary of all appointments that day. */
  private async maybeNotifyMasterDayFull(masterId: string, date: string, serviceId: string): Promise<void> {
    const freeSlots = await this.getAvailableSlotsForDate(date, serviceId, masterId);
    if (freeSlots.length > 0) return;
    const master = await this.userRepo.findOne({ where: { id: masterId }, select: ['telegramId'] });
    const masterTgId = master?.telegramId?.trim();
    if (!masterTgId) return;
    const appointments = await this.appointmentRepo.find({
      where: { masterId, date, status: AppointmentStatus.SCHEDULED },
      relations: ['client', 'service'],
      order: { startTime: 'ASC' },
    });
    if (appointments.length === 0) return;
    const dateStr = date.slice(0, 10);
    const lines = appointments.map((a) => {
      const timeStr = (a.startTime || '').slice(0, 5);
      const clientName = a.client?.name ?? 'Клиент';
      const serviceName = a.service?.name ?? '—';
      return `• ${timeStr} — ${this.escapeHtml(clientName)}, ${this.escapeHtml(serviceName)}`;
    });
    const text = `📋 На ${dateStr} свободных слотов не осталось. Записи на этот день:\n\n${lines.join('\n')}`;
    await this.botService.sendMessage(masterTgId, text);
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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

  /** Submit a review for a completed appointment. One review per appointment. */
  async submitReview(
    user: User,
    appointmentId: string,
    rating: number,
    comment: string | null,
  ): Promise<AppointmentFeedback> {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be an integer between 1 and 5');
    }
    const clientIds = await this.getMyClientIds(user);
    if (clientIds.length === 0) throw new ForbiddenException('No client record found');

    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId, clientId: In(clientIds) },
      relations: ['feedback'],
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.status !== AppointmentStatus.DONE) {
      throw new BadRequestException('Reviews can only be left for completed appointments');
    }
    if (appointment.feedback) throw new BadRequestException('Review already submitted');

    const feedback = this.feedbackRepo.create({
      appointmentId,
      rating,
      comment: comment?.trim() || null,
    });
    return this.feedbackRepo.save(feedback);
  }

  /** Public master profile: name, photo, aggregated rating, last 20 reviews. */
  async getMasterPublicProfile(masterId: string) {
    const master = await this.userRepo.findOne({
      where: { id: masterId, isMaster: true },
      select: ['id', 'firstName', 'lastName', 'photoUrl', 'address'],
    });
    if (!master) throw new NotFoundException('Master not found');

    const appointments = await this.appointmentRepo.find({
      where: { masterId },
      relations: ['feedback', 'service'],
      select: ['id', 'date', 'service', 'feedback'],
    });

    const withFeedback = appointments.filter((a) => a.feedback);
    const count = withFeedback.length;
    const average =
      count > 0
        ? Math.round((withFeedback.reduce((s, a) => s + a.feedback!.rating, 0) / count) * 10) / 10
        : null;

    const reviews = withFeedback
      .sort((a, b) => b.feedback!.createdAt.getTime() - a.feedback!.createdAt.getTime())
      .slice(0, 20)
      .map((a) => ({
        rating: a.feedback!.rating,
        comment: a.feedback!.comment,
        serviceName: a.service?.name ?? null,
        createdAt: a.feedback!.createdAt,
      }));

    return {
      id: master.id,
      firstName: master.firstName,
      lastName: master.lastName,
      photoUrl: master.photoUrl,
      address: master.address,
      averageRating: average,
      reviewCount: count,
      reviews,
    };
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
      const clientTgId = appointment.client?.telegramId?.trim();
      const mention = clientTgId
        ? `<a href="tg://user?id=${clientTgId}">${this.escapeHtml(clientName)}</a>`
        : clientUsername
          ? `@${clientUsername}`
          : this.escapeHtml(clientName);
      const serviceName = appointment.service?.name ?? '';
      const text = `❌ Клиент отменил запись: ${dateStr} ${timeStr}${serviceName ? `, ${this.escapeHtml(serviceName)}` : ''}. Клиент: ${mention}. Причина: ${this.escapeHtml(reasonText)}`;
      await this.botService.sendMessage(masterTgId, text);
    }

    return saved;
  }

  /** Create payment invoice for an appointment. */
  async createPaymentInvoice(user: User, appointmentId: string) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['client', 'master', 'service'],
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.client?.telegramId !== user.telegramId) {
      throw new ForbiddenException('Only the booking client can create payment');
    }
    if (appointment.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException('This appointment is already paid or payment failed');
    }

    const serviceFeePercent = parseInt(this.configService.get('SERVICE_FEE_PERCENT') || '5', 10);
    const basePrice = appointment.finalPrice
      ? Number(appointment.finalPrice)
      : appointment.service?.price
        ? Number(appointment.service.price)
        : 0;

    if (basePrice === 0) {
      throw new BadRequestException('Appointment price is not set');
    }

    const totalPrice = basePrice;
    const invoiceId = `appt_${appointmentId}_${Date.now()}`;

    appointment.totalPrice = totalPrice as any;
    appointment.invoiceId = invoiceId;
    await this.appointmentRepo.save(appointment);

    const serviceName = appointment.service?.name ?? 'Запись';
    const currency = 'EUR';
    const amountCents = Math.round(totalPrice * 100);

    const invoiceUrl = await this.botService.createInvoiceLink({
      invoiceId,
      title: serviceName,
      description: `Запись на ${appointment.date} ${appointment.startTime.slice(0, 5)}`,
      amountCents,
      currency,
    });

    return {
      invoiceId,
      appointmentId,
      amount: amountCents,
      currency,
      serviceName,
      totalPrice: basePrice,
      serviceFeePercent,
      invoiceUrl,
    };
  }

  /** Confirm payment from webhook. */
  async confirmPayment(invoiceId: string) {
    const appointment = await this.appointmentRepo.findOne({
      where: { invoiceId },
      relations: ['client', 'master', 'service'],
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    appointment.paymentStatus = PaymentStatus.PAID;
    appointment.paidAt = new Date();
    const saved = await this.appointmentRepo.save(appointment);

    const clientTgId = appointment.client?.telegramId?.trim();
    if (clientTgId) {
      const dateStr = typeof appointment.date === 'string' ? appointment.date : (appointment.date as Date).toISOString().slice(0, 10);
      const timeStr = (appointment.startTime || '').slice(0, 5);
      const serviceName = appointment.service?.name ?? '';
      const text = `✅ Платёж подтвержден. Вы записаны на ${dateStr} ${timeStr}${serviceName ? `, ${serviceName}` : ''}.`;
      await this.botService.sendMessage(clientTgId, text);
    }

    return saved;
  }
}
