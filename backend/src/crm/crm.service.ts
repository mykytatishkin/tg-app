import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { Service } from './entities/service.entity';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { Appointment, AppointmentStatus, AppointmentSource } from './entities/appointment.entity';
import { MonthlyExpense } from './entities/monthly-expense.entity';
import { User } from '../auth/entities/user.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CreateMonthlyExpenseDto } from './dto/create-monthly-expense.dto';
import { UpsertMonthlyExpenseDto } from './dto/upsert-monthly-expense.dto';
import { BotService } from '../bot/bot.service';
import { ClientRemindersService } from './client-reminders.service';

@Injectable()
export class CrmService {
  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Service)
    private serviceRepo: Repository<Service>,
    @InjectRepository(AvailabilitySlot)
    private slotRepo: Repository<AvailabilitySlot>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(MonthlyExpense)
    private monthlyExpenseRepo: Repository<MonthlyExpense>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private botService: BotService,
    private clientRemindersService: ClientRemindersService,
  ) {}

  private async getMasterId(user: User): Promise<string> {
    if (user.isMaster) return user.id;
    const master = await this.userRepo.findOne({ where: { isMaster: true } });
    if (!master) throw new ForbiddenException('No master configured');
    return master.id;
  }

  /** Collect all telegramIds to notify about new discounts: clients + registered users (who opened the app). */
  private async getTelegramIdsForDiscountNotification(masterId: string): Promise<string[]> {
    const clients = await this.clientRepo.find({
      where: { masterId },
      select: ['telegramId'],
    });
    const fromClients = clients.map((c) => c.telegramId?.trim()).filter(Boolean) as string[];
    const clientSet = new Set(fromClients);
    const registered = await this.userRepo.find({
      where: { isMaster: false, isAdmin: false },
      select: ['telegramId'],
    });
    const fromUsers = registered
      .map((u) => u.telegramId?.trim())
      .filter((id): id is string => Boolean(id) && !clientSet.has(id));
    return [...fromClients, ...fromUsers];
  }

  /** Id prefix for "user-only" entries (registered but never booked). */
  private static readonly USER_ONLY_PREFIX = 'u-';

  async getClients(user: User) {
    const masterId = await this.getMasterId(user);
    const clients = await this.clientRepo.find({
      where: { masterId },
      order: { name: 'ASC' },
      relations: ['appointments'],
    });
    const clientTelegramIds = new Set(clients.map((c) => c.telegramId).filter(Boolean));
    const registeredOnly = await this.userRepo.find({
      where: { isMaster: false, isAdmin: false },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    const registeredOnlyForMaster = registeredOnly.filter(
      (u) => u.telegramId && !clientTelegramIds.has(u.telegramId),
    );
    const list = clients.map((c) => {
      const doneOrScheduled = (c.appointments || []).filter(
        (a) => a.status === AppointmentStatus.DONE || a.status === AppointmentStatus.SCHEDULED,
      );
      const lastVisit =
        doneOrScheduled.length > 0
          ? doneOrScheduled.reduce((max, a) => {
              const d = new Date(`${a.date}T${a.startTime}`);
              return d > max ? d : max;
            }, new Date(0))
          : null;
      const { appointments: _, ...rest } = c;
      return {
        ...rest,
        visitCount: doneOrScheduled.length,
        lastVisitAt: lastVisit ? lastVisit.toISOString() : null,
      };
    });
    for (const u of registeredOnlyForMaster) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'Без имени';
      list.push({
        id: `${CrmService.USER_ONLY_PREFIX}${u.id}`,
        name,
        telegramId: u.telegramId,
        username: u.username,
        instagram: null,
        phone: u.phone,
        notes: null,
        masterNickname: null,
        lastReminderSentAt: null,
        masterId,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        visitCount: 0,
        lastVisitAt: null,
      });
    }
    list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return list;
  }

  async createClient(user: User, dto: CreateClientDto) {
    const masterId = await this.getMasterId(user);
    const client = this.clientRepo.create({ ...dto, masterId });
    return this.clientRepo.save(client);
  }

  async getClient(user: User, id: string) {
    const masterId = await this.getMasterId(user);
    if (id.startsWith(CrmService.USER_ONLY_PREFIX)) {
      const userId = id.slice(CrmService.USER_ONLY_PREFIX.length);
      const u = await this.userRepo.findOne({
        where: { id: userId, isMaster: false, isAdmin: false },
      });
      if (!u?.telegramId) throw new ForbiddenException('Client not found');
      const hasClient = await this.clientRepo.findOne({
        where: { masterId, telegramId: u.telegramId },
      });
      if (hasClient) throw new ForbiddenException('Client not found');
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || 'Без имени';
      return {
        id: `${CrmService.USER_ONLY_PREFIX}${u.id}`,
        name,
        telegramId: u.telegramId,
        username: u.username,
        instagram: null,
        phone: u.phone,
        notes: null,
        masterNickname: null,
        lastReminderSentAt: null,
        masterId,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        stats: {
          totalVisits: 0,
          lastVisitAt: null,
          byService: [],
          favoriteWeekdays: [],
          favoriteTimeRanges: [],
        },
        recentAppointments: [],
      };
    }
    const client = await this.clientRepo.findOne({
      where: { id, masterId },
      relations: ['appointments', 'appointments.service'],
    });
    if (!client) throw new ForbiddenException('Client not found');
    const doneOrScheduled = (client.appointments || []).filter(
      (a) => a.status === AppointmentStatus.DONE || a.status === AppointmentStatus.SCHEDULED,
    );
    const byServiceMap = new Map<string, { serviceId: string; serviceName: string; count: number }>();
    for (const a of doneOrScheduled) {
      const sid = a.serviceId;
      if (!sid) continue;
      const name = (a as any).service?.name ?? 'Service';
      if (!byServiceMap.has(sid)) byServiceMap.set(sid, { serviceId: sid, serviceName: name, count: 0 });
      byServiceMap.get(sid)!.count += 1;
    }
    const lastVisit =
      doneOrScheduled.length > 0
        ? doneOrScheduled.reduce((max, a) => {
            const d = new Date(`${a.date}T${a.startTime}`);
            return d > max ? d : max;
          }, new Date(0))
        : null;
    const sorted = [...doneOrScheduled].sort((a, b) => {
      const da = new Date(`${a.date}T${a.startTime}`);
      const db = new Date(`${b.date}T${b.startTime}`);
      return db.getTime() - da.getTime();
    });

    const weekdayCounts = new Map<number, number>();
    const timeBucketCounts = new Map<string, number>();
    const WEEKDAY_NAMES = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const TIME_BUCKET_LABELS: Record<string, string> = { morning: 'Утро (до 12:00)', afternoon: 'День (12:00–18:00)', evening: 'Вечер (после 18:00)' };
    for (const a of doneOrScheduled) {
      const dStr = typeof a.date === 'string' ? a.date : (a.date as Date)?.toISOString?.()?.slice(0, 10);
      if (dStr) {
        const day = new Date(dStr + 'T12:00:00').getDay();
        weekdayCounts.set(day, (weekdayCounts.get(day) ?? 0) + 1);
      }
      if (a.startTime) {
        const hour = parseInt(String(a.startTime).slice(0, 2), 10) || 0;
        const bucket = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        timeBucketCounts.set(bucket, (timeBucketCounts.get(bucket) ?? 0) + 1);
      }
    }
    const top2Weekdays = Array.from(weekdayCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([day]) => ({ day, label: WEEKDAY_NAMES[day] }));
    const top2TimeRanges = Array.from(timeBucketCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([bucket]) => ({ bucket, label: TIME_BUCKET_LABELS[bucket] ?? bucket }));

    const stats = {
      totalVisits: doneOrScheduled.length,
      lastVisitAt: lastVisit ? lastVisit.toISOString() : null,
      byService: Array.from(byServiceMap.values()).sort((a, b) => b.count - a.count),
      favoriteWeekdays: top2Weekdays,
      favoriteTimeRanges: top2TimeRanges,
    };
    const recentAppointments = sorted.slice(0, 30).map((a) => ({
      id: a.id,
      date: a.date,
      startTime: a.startTime,
      status: a.status,
      serviceName: (a as any).service?.name ?? (a.serviceId ? null : 'Для моделей'),
    }));
    const { appointments: _, ...rest } = client;
    return { ...rest, stats, recentAppointments };
  }

  async updateClient(user: User, id: string, dto: UpdateClientDto) {
    const masterId = await this.getMasterId(user);
    if (id.startsWith(CrmService.USER_ONLY_PREFIX)) {
      const userId = id.slice(CrmService.USER_ONLY_PREFIX.length);
      const u = await this.userRepo.findOne({
        where: { id: userId, isMaster: false, isAdmin: false },
      });
      if (!u?.telegramId) throw new ForbiddenException('Client not found');
      let client = await this.clientRepo.findOne({
        where: { masterId, telegramId: u.telegramId },
      });
      if (!client) {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || dto.name ?? 'Без имени';
        client = this.clientRepo.create({
          masterId,
          name: dto.name ?? name,
          telegramId: u.telegramId,
          username: dto.username ?? u.username,
          phone: dto.phone ?? u.phone,
          instagram: dto.instagram ?? null,
          notes: dto.notes ?? null,
          masterNickname: dto.masterNickname ?? null,
        });
        await this.clientRepo.save(client);
      }
      if (Object.keys(dto).length > 0) {
        await this.clientRepo.update({ id: client.id, masterId }, dto);
      }
      return this.getClient(user, client.id);
    }
    await this.clientRepo.update({ id, masterId }, dto);
    return this.getClient(user, id);
  }

  /** Master sends reminder to client: "simple" = 14-day style (one button), "smart" = 21-day style (suggested slots). */
  async sendReminderToClient(
    user: User,
    clientId: string,
    type: 'simple' | 'smart',
  ): Promise<{ sent: boolean; message?: string }> {
    if (clientId.startsWith(CrmService.USER_ONLY_PREFIX)) {
      throw new BadRequestException(
        'У этого пользователя ещё не было записей. Сохраните карточку клиента или дождитесь первой записи, затем можно отправить напоминание.',
      );
    }
    const clientData = await this.getClient(user, clientId);
    if (!clientData.telegramId?.trim()) {
      throw new BadRequestException('У клиента не указан Telegram — напоминание отправить нельзя.');
    }
    const payload = {
      id: clientData.id,
      name: clientData.name ?? null,
      telegramId: clientData.telegramId,
      masterId: clientData.masterId,
    };
    const sent =
      type === 'simple'
        ? await this.clientRemindersService.sendSimpleReminderToClient(payload)
        : await this.clientRemindersService.sendSmartReminderToClient(payload);
    return { sent, message: sent ? 'Напоминание отправлено.' : 'Не удалось отправить (бот недоступен или клиент не начал диалог).' };
  }

  async deleteClient(user: User, id: string) {
    const masterId = await this.getMasterId(user);
    const result = await this.clientRepo.delete({ id, masterId });
    if (result.affected === 0) throw new ForbiddenException('Client not found');
  }

  async getServices(user: User) {
    const masterId = await this.getMasterId(user);
    return this.serviceRepo.find({
      where: { masterId },
      order: { name: 'ASC' },
    });
  }

  async createService(user: User, dto: CreateServiceDto) {
    const masterId = await this.getMasterId(user);
    const service = this.serviceRepo.create({
      ...dto,
      masterId,
      durationMinutes: dto.durationMinutes ?? 60,
    });
    return this.serviceRepo.save(service);
  }

  async getService(user: User, id: string) {
    const masterId = await this.getMasterId(user);
    const service = await this.serviceRepo.findOne({
      where: { id, masterId },
    });
    if (!service) throw new ForbiddenException('Service not found');
    return service;
  }

  async updateService(user: User, id: string, dto: UpdateServiceDto) {
    const masterId = await this.getMasterId(user);
    await this.serviceRepo.update({ id, masterId }, dto);
    return this.getService(user, id);
  }

  async deleteService(user: User, id: string) {
    const masterId = await this.getMasterId(user);
    const result = await this.serviceRepo.delete({ id, masterId });
    if (result.affected === 0) throw new ForbiddenException('Service not found');
  }

  async getAvailability(user: User, from?: string, to?: string) {
    const masterId = await this.getMasterId(user);
    const qb = this.slotRepo
      .createQueryBuilder('slot')
      .leftJoinAndSelect('slot.service', 'service')
      .where('slot.masterId = :masterId', { masterId })
      .orderBy('slot.date', 'ASC')
      .addOrderBy('slot.startTime', 'ASC');
    if (from) qb.andWhere('slot.date >= :from', { from });
    if (to) qb.andWhere('slot.date <= :to', { to });
    return qb.getMany();
  }

  /** Преобразует время "HH:MM" или "HH:MM:SS" в минуты от полуночи. */
  private timeToMinutes(t: string): number {
    const parts = String(t ?? '').trim().split(':').map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    return h * 60 + m;
  }

  /** Проверяет, пересекаются ли два интервала [start1,end1] и [start2,end2] (в минутах). */
  private timeRangesOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  async createAvailability(user: User, dto: CreateAvailabilityDto) {
    const masterId = await this.getMasterId(user);
    const startMin = this.timeToMinutes(dto.startTime);
    const endMin = this.timeToMinutes(dto.endTime);
    if (startMin >= endMin) {
      throw new BadRequestException('Время начала должно быть раньше времени окончания');
    }
    const existing = await this.slotRepo.find({
      where: { masterId, date: dto.date },
      select: ['id', 'startTime', 'endTime'],
    });
    for (const s of existing) {
      const sStart = this.timeToMinutes(s.startTime);
      const sEnd = this.timeToMinutes(s.endTime);
      if (this.timeRangesOverlap(startMin, endMin, sStart, sEnd)) {
        throw new BadRequestException(
          'Этот промежуток пересекается с уже существующим слотом на эту дату',
        );
      }
    }
    if (dto.forModels === true) {
      if (!dto.serviceId?.trim()) {
        throw new BadRequestException('Для слота «для моделей» укажите услугу');
      }
      const service = await this.serviceRepo.findOne({
        where: { id: dto.serviceId.trim(), masterId, forModels: true },
      });
      if (!service) {
        throw new BadRequestException('Услуга не найдена или не для моделей');
      }
    }
    const slot = this.slotRepo.create({
      ...dto,
      masterId,
      isAvailable: dto.isAvailable ?? true,
      serviceId: dto.forModels && dto.serviceId ? dto.serviceId.trim() : null,
    });
    const saved = await this.slotRepo.save(slot);
    const hasNewDiscount =
      saved.priceModifier != null && Number(saved.priceModifier) < 0;
    if (hasNewDiscount) {
      const telegramIds = await this.getTelegramIdsForDiscountNotification(masterId);
      if (telegramIds.length > 0) {
        this.botService.notifyAllAboutNewDiscounts(telegramIds).catch((err) => {
          console.error('Notify about new discount error:', err);
        });
      }
    }
    return saved;
  }

  async updateAvailability(user: User, id: string, dto: UpdateAvailabilityDto) {
    const masterId = await this.getMasterId(user);
    const slot = await this.slotRepo.findOne({ where: { id, masterId } });
    if (!slot) throw new ForbiddenException('Slot not found');
    const date = dto.date ?? slot.date;
    const startTime = dto.startTime ?? slot.startTime;
    const endTime = dto.endTime ?? slot.endTime;
    const startMin = this.timeToMinutes(startTime);
    const endMin = this.timeToMinutes(endTime);
    if (startMin >= endMin) {
      throw new BadRequestException('Время начала должно быть раньше времени окончания');
    }
    const existing = await this.slotRepo.find({
      where: { masterId, date },
      select: ['id', 'startTime', 'endTime'],
    });
    for (const s of existing) {
      if (s.id === id) continue;
      const sStart = this.timeToMinutes(s.startTime);
      const sEnd = this.timeToMinutes(s.endTime);
      if (this.timeRangesOverlap(startMin, endMin, sStart, sEnd)) {
        throw new BadRequestException(
          'Этот промежуток пересекается с уже существующим слотом на эту дату',
        );
      }
    }
    const forModels = dto.forModels ?? slot.forModels;
    if (forModels === true) {
      const serviceId = dto.serviceId ?? slot.serviceId;
      if (!serviceId?.trim()) {
        throw new BadRequestException('Для слота «для моделей» укажите услугу');
      }
      const service = await this.serviceRepo.findOne({
        where: { id: serviceId.trim(), masterId, forModels: true },
      });
      if (!service) {
        throw new BadRequestException('Услуга не найдена или не для моделей');
      }
    }
    const oldPriceModifier = slot.priceModifier != null ? Number(slot.priceModifier) : null;
    const hadDiscount = oldPriceModifier != null && oldPriceModifier < 0;

    const updateData = { ...dto };
    if (forModels !== true) updateData.serviceId = null;
    else if (dto.serviceId) updateData.serviceId = dto.serviceId.trim();
    await this.slotRepo.update({ id, masterId }, updateData);
    const updated = await this.slotRepo.findOne({ where: { id, masterId } });
    const newPriceModifier =
      updated?.priceModifier != null ? Number(updated.priceModifier) : null;
    const hasNewDiscount =
      !hadDiscount && newPriceModifier != null && newPriceModifier < 0;
    if (hasNewDiscount) {
      const telegramIds = await this.getTelegramIdsForDiscountNotification(masterId);
      if (telegramIds.length > 0) {
        this.botService.notifyAllAboutNewDiscounts(telegramIds).catch((err) => {
          console.error('Notify about new discount error:', err);
        });
      }
    }
    return updated;
  }

  async deleteAvailability(user: User, id: string) {
    const masterId = await this.getMasterId(user);
    const slot = await this.slotRepo.findOne({ where: { id, masterId } });
    if (!slot) throw new ForbiddenException('Slot not found');
    await this.appointmentRepo.update({ slotId: id }, { slotId: null });
    await this.slotRepo.delete({ id, masterId });
  }

  async getAppointments(user: User, from?: string, to?: string, upcomingOnly?: boolean) {
    const masterId = await this.getMasterId(user);
    const qb = this.appointmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.client', 'client')
      .leftJoinAndSelect('a.service', 'service')
      .where('a.masterId = :masterId', { masterId })
      .orderBy('a.date', 'DESC')
      .addOrderBy('a.startTime', 'DESC');
    if (from) qb.andWhere('a.date >= :from', { from });
    if (to) qb.andWhere('a.date <= :to', { to });
    if (upcomingOnly === true) {
      qb.andWhere('a.status = :scheduled', { scheduled: AppointmentStatus.SCHEDULED });
      qb.andWhere(
        '(a.date > CURRENT_DATE OR (a.date = CURRENT_DATE AND a.startTime >= CURRENT_TIME))',
      );
    }
    return qb.getMany();
  }

  async createAppointment(user: User, dto: CreateAppointmentDto) {
    const masterId = await this.getMasterId(user);
    const appointment = this.appointmentRepo.create({
      ...dto,
      masterId,
      status: dto.status ?? AppointmentStatus.SCHEDULED,
      source: AppointmentSource.MANUAL,
    });
    return this.appointmentRepo.save(appointment);
  }

  async getAppointment(user: User, id: string) {
    const masterId = await this.getMasterId(user);
    const appointment = await this.appointmentRepo.findOne({
      where: { id, masterId },
      relations: ['client', 'service', 'feedback'],
    });
    if (!appointment) throw new ForbiddenException('Appointment not found');
    return appointment;
  }

  async updateAppointment(user: User, id: string, dto: UpdateAppointmentDto) {
    const masterId = await this.getMasterId(user);
    const previous = await this.appointmentRepo.findOne({
      where: { id, masterId },
      relations: ['client', 'service', 'master', 'feedback'],
    });
    const isCancelling = dto.status === AppointmentStatus.CANCELLED;
    const cancellationReasonText = isCancelling
      ? (dto.cancellationReason && String(dto.cancellationReason).trim()) || 'Не указана'
      : undefined;
    const updatePayload: Partial<Appointment> = { ...dto };
    if (isCancelling) {
      updatePayload.cancellationReason = cancellationReasonText!;
      updatePayload.cancelledBy = 'master';
    }
    await this.appointmentRepo.update({ id, masterId }, updatePayload);
    const updated = await this.getAppointment(user, id);
    if (dto.status === AppointmentStatus.CANCELLED && previous?.client?.telegramId) {
      const timeStr = (previous.startTime || '').slice(0, 5);
      const dateTimeStr = `${previous.date} ${timeStr}`;
      const serviceName = previous.service?.name ?? '';
      const text = `❌ Ваша запись отменена мастером: ${dateTimeStr}${serviceName ? `, ${serviceName}` : ''}. Причина: ${cancellationReasonText ?? 'Не указана'}`;
      await this.botService.sendMessage(previous.client.telegramId, text);
    }
    if (
      dto.status === AppointmentStatus.DONE &&
      previous?.client?.telegramId &&
      !previous.feedback &&
      !(previous as { feedbackRequestedAt?: Date | null }).feedbackRequestedAt
    ) {
      const options =
        (previous.master as { feedbackOptions?: string[] | null })?.feedbackOptions ??
        ['Качество работы', 'Общение', 'Атмосфера', 'Скорость'];
      await this.botService.sendFeedbackRequest(
        previous.client.telegramId,
        id,
        Array.isArray(options) && options.length > 0 ? options : ['Качество работы', 'Общение', 'Атмосфера', 'Скорость'],
      );
      await this.appointmentRepo.update(
        { id, masterId },
        { feedbackRequestedAt: new Date() },
      );
    }
    return updated;
  }

  async deleteAppointment(user: User, id: string) {
    const masterId = await this.getMasterId(user);
    const result = await this.appointmentRepo.delete({ id, masterId });
    if (result.affected === 0) throw new ForbiddenException('Appointment not found');
  }

  /** Get monthly expenses, optionally filtered by yearMonth. */
  async getExpenses(user: User, yearMonth?: string) {
    const masterId = await this.getMasterId(user);
    const qb = this.monthlyExpenseRepo
      .createQueryBuilder('e')
      .where('e.masterId = :masterId', { masterId })
      .orderBy('e.yearMonth', 'DESC');
    if (yearMonth) qb.andWhere('e.yearMonth = :yearMonth', { yearMonth });
    return qb.getMany();
  }

  /** Upsert monthly expense for given yearMonth. */
  async upsertExpense(user: User, yearMonth: string, dto: UpsertMonthlyExpenseDto) {
    const masterId = await this.getMasterId(user);
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
      throw new BadRequestException('yearMonth must be YYYY-MM format');
    }
    let expense = await this.monthlyExpenseRepo.findOne({
      where: { masterId, yearMonth },
    });
    if (expense) {
      await this.monthlyExpenseRepo.update({ id: expense.id }, dto);
      return this.monthlyExpenseRepo.findOne({ where: { id: expense!.id } });
    }
    expense = this.monthlyExpenseRepo.create({
      masterId,
      yearMonth,
      amount: dto.amount ?? 0,
    });
    return this.monthlyExpenseRepo.save(expense);
  }

  /** Statistics: services with booking count, total appointments, clients count, earnings by month, feedback. */
  async getStats(user: User, year?: string, month?: string) {
    const masterId = await this.getMasterId(user);
    const appointments = await this.appointmentRepo.find({
      where: { masterId },
      relations: ['service', 'feedback'],
    });
    const doneOrScheduled = appointments.filter(
      (a) => a.status === AppointmentStatus.DONE || a.status === AppointmentStatus.SCHEDULED,
    );
    const doneOnly = appointments.filter((a) => a.status === AppointmentStatus.DONE);

    const byServiceMap = new Map<string, { serviceId: string; serviceName: string; count: number }>();
    for (const a of doneOrScheduled) {
      const sid = a.serviceId;
      if (!sid) continue;
      const name = (a as any).service?.name ?? 'Service';
      if (!byServiceMap.has(sid)) byServiceMap.set(sid, { serviceId: sid, serviceName: name, count: 0 });
      byServiceMap.get(sid)!.count += 1;
    }

    const clientsCount = await this.clientRepo.count({ where: { masterId } });

    const byMonthMap = new Map<
      string,
      { revenue: number; cost: number; appointmentCount: number }
    >();
    for (const a of doneOnly) {
      const yearMonth = String(a.date).slice(0, 7);
      if (year && yearMonth.slice(0, 4) !== year) continue;
      if (month && yearMonth.slice(5, 7) !== month) continue;

      if (!byMonthMap.has(yearMonth)) {
        byMonthMap.set(yearMonth, { revenue: 0, cost: 0, appointmentCount: 0 });
      }
      const row = byMonthMap.get(yearMonth)!;
      row.appointmentCount += 1;

      const service = (a as any).service;
      const revenue =
        a.finalPrice != null
          ? Number(a.finalPrice)
          : service?.price != null
            ? Number(service.price)
            : 0;
      const cost = service?.cost != null ? Number(service.cost) : 0;
      row.revenue += revenue;
      row.cost += cost;
    }

    const expenses = await this.monthlyExpenseRepo.find({
      where: { masterId },
    });
    const expenseByMonth = new Map<string, number>();
    for (const e of expenses) {
      if (year && e.yearMonth.slice(0, 4) !== year) continue;
      if (month && e.yearMonth.slice(5, 7) !== month) continue;
      expenseByMonth.set(e.yearMonth, Number(e.amount));
    }

    const byMonth = Array.from(byMonthMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([yearMonth, row]) => {
        const monthlyExpense = expenseByMonth.get(yearMonth) ?? 0;
        const profit = row.revenue - row.cost - monthlyExpense;
        return {
          yearMonth,
          ...row,
          monthlyExpense,
          profit,
        };
      });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalMonthlyExpenses = 0;
    for (const row of byMonth) {
      totalRevenue += row.revenue;
      totalCost += row.cost;
      totalMonthlyExpenses += row.monthlyExpense;
    }
    const totals = {
      revenue: totalRevenue,
      cost: totalCost,
      monthlyExpenses: totalMonthlyExpenses,
      profit: totalRevenue - totalCost - totalMonthlyExpenses,
    };

    const feedbackList = appointments
      .map((a) => (a as { feedback?: { rating: number } | null }).feedback)
      .filter(Boolean) as { rating: number }[];
    const feedbackCount = feedbackList.length;
    const averageRating =
      feedbackCount > 0
        ? feedbackList.reduce((s, f) => s + f.rating, 0) / feedbackCount
        : null;

    return {
      totalAppointments: doneOrScheduled.length,
      totalClients: clientsCount,
      byService: Array.from(byServiceMap.values()).sort((a, b) => b.count - a.count),
      byMonth,
      totals,
      feedbackCount,
      averageRating: averageRating != null ? Math.round(averageRating * 10) / 10 : null,
    };
  }
}
