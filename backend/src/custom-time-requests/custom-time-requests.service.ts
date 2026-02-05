import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Client } from '../crm/entities/client.entity';
import { Service } from '../crm/entities/service.entity';
import { AvailabilitySlot } from '../crm/entities/availability-slot.entity';
import {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
} from '../crm/entities/appointment.entity';
import {
  CustomTimeRequest,
  CustomTimeRequestStatus,
} from '../crm/entities/custom-time-request.entity';
import { CreateCustomTimeRequestDto } from '../crm/dto/create-custom-time-request.dto';
import { BotService } from '../bot/bot.service';

const FEE_TODAY = 15;
const FEE_TOMORROW = 10;
const FEE_LATER = 5;

/** Default start time when client does not specify. */
const DEFAULT_START_TIME = '10:00';

@Injectable()
export class CustomTimeRequestsService {
  constructor(
    @InjectRepository(CustomTimeRequest)
    private requestRepo: Repository<CustomTimeRequest>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Service)
    private serviceRepo: Repository<Service>,
    @InjectRepository(AvailabilitySlot)
    private slotRepo: Repository<AvailabilitySlot>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    private botService: BotService,
    private configService: ConfigService,
  ) {}

  /** Compute fee in € by requested date: today +15, tomorrow +10, else +5. Uses UTC date. */
  getFeeForDate(requestedDateStr: string): number {
    const requested = new Date(requestedDateStr + 'T12:00:00Z');
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const requestedDay = new Date(Date.UTC(requested.getUTCFullYear(), requested.getUTCMonth(), requested.getUTCDate()));
    const diffDays = Math.round((requestedDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return FEE_TODAY;
    if (diffDays === 1) return FEE_TOMORROW;
    return FEE_LATER;
  }

  /** Add minutes to "HH:mm" or "HH:mm:ss", return "HH:mm". */
  private addMinutesToTime(timeStr: string, addMinutes: number): string {
    const parts = String(timeStr ?? '').trim().split(':').map(Number);
    let m = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
    m += addMinutes;
    const h = Math.floor(m / 60) % 24;
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  private timeToMinutes(t: string): number {
    const parts = String(t ?? '').trim().split(':').map(Number);
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }

  private timeRangesOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }

  async create(user: User, dto: CreateCustomTimeRequestDto) {
    const master = await this.userRepo.findOne({
      where: { id: dto.masterId, isMaster: true },
    });
    if (!master) throw new BadRequestException('Мастер не найден');

    const service = await this.serviceRepo.findOne({
      where: { id: dto.serviceId, masterId: dto.masterId, forModels: false },
    });
    if (!service) throw new BadRequestException('Услуга не найдена или недоступна для записи');

    const requestedDate = dto.requestedDate.trim();
    const todayStr = new Date().toISOString().slice(0, 10);
    if (requestedDate < todayStr) {
      throw new BadRequestException('Дата должна быть сегодня или в будущем');
    }

    let client = await this.clientRepo.findOne({
      where: { telegramId: user.telegramId, masterId: dto.masterId },
    });
    if (!client) {
      client = this.clientRepo.create({
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        telegramId: user.telegramId,
        username: user.username ?? null,
        masterId: dto.masterId,
      });
      await this.clientRepo.save(client);
    }

    const startTime = (dto.requestedStartTime ?? DEFAULT_START_TIME).trim();
    if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(startTime)) {
      throw new BadRequestException('Неверный формат времени (используйте ЧЧ:ММ)');
    }
    const durationMinutes = service.durationMinutes ?? 60;
    const endTime = this.addMinutesToTime(startTime, durationMinutes);

    const feeAmount = this.getFeeForDate(requestedDate);

    const request = this.requestRepo.create({
      clientId: client.id,
      masterId: dto.masterId,
      serviceId: service.id,
      requestedDate,
      requestedStartTime: startTime.length === 5 ? startTime : startTime.slice(0, 5),
      requestedEndTime: endTime.length === 5 ? endTime : endTime.slice(0, 5),
      status: 'pending' as CustomTimeRequestStatus,
      feeAmount,
      note: dto.note?.trim() || null,
    });
    const saved = await this.requestRepo.save(request);

    await this.notifyMasterNewRequest(saved);

    return {
      id: saved.id,
      requestedDate: saved.requestedDate,
      requestedStartTime: saved.requestedStartTime,
      feeAmount: Number(saved.feeAmount),
      status: saved.status,
      createdAt: saved.createdAt,
    };
  }

  private async notifyMasterNewRequest(request: CustomTimeRequest): Promise<void> {
    const master = await this.userRepo.findOne({
      where: { id: request.masterId },
      select: ['telegramId'],
    });
    const masterTgId = master?.telegramId?.trim();
    if (!masterTgId) return;

    const appUrl = this.configService.get<string>('MINI_APP_URL');
    const adminPath = appUrl ? `${appUrl.replace(/\/$/, '')}/admin/custom-time-requests` : '';

    const requestWithRelations = await this.requestRepo.findOne({
      where: { id: request.id },
      relations: ['client', 'service'],
    });
    const clientName = requestWithRelations?.client?.name ?? 'Клиентка';
    const serviceName = requestWithRelations?.service?.name ?? 'Услуга';
    const dateStr = request.requestedDate;
    const timeStr = (request.requestedStartTime ?? '').slice(0, 5);
    const fee = Number(request.feeAmount);
    let text = `🕐 Новый запрос своего времени: ${dateStr} ${timeStr}, ${this.escapeHtml(serviceName)}, ${this.escapeHtml(clientName)}. Доплата +${fee} €.`;
    if (adminPath) {
      await this.botService.sendMessageWithWebAppButton(
        masterTgId,
        text,
        'Открыть заявки',
        adminPath,
      );
    } else {
      await this.botService.sendMessage(masterTgId, text);
    }
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** List for admin or master; masters see only their requests. Pending first. */
  async findAll(user: User, filterMasterId?: string): Promise<CustomTimeRequest[]> {
    const masterIds = await this.getMasterIds(user);
    const effectiveMasterIds =
      user.isAdmin && filterMasterId && masterIds.includes(filterMasterId)
        ? [filterMasterId]
        : masterIds;

    const qb = this.requestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.client', 'client')
      .leftJoinAndSelect('r.service', 'service')
      .leftJoinAndSelect('r.master', 'master')
      .where('r.masterId IN (:...masterIds)', { masterIds: effectiveMasterIds })
      .orderBy("CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END", 'ASC')
      .addOrderBy('r.createdAt', 'DESC');

    return qb.getMany();
  }

  private async getMasterIds(user: User): Promise<string[]> {
    if (user.isMaster) return [user.id];
    if (user.isAdmin) {
      const masters = await this.userRepo.find({
        where: { isMaster: true },
        select: ['id'],
      });
      return masters.map((m) => m.id);
    }
    const master = await this.userRepo.findOne({ where: { isMaster: true }, select: ['id'] });
    return master ? [master.id] : [];
  }

  async accept(user: User, id: string) {
    const masterIds = await this.getMasterIds(user);
    const request = await this.requestRepo.findOne({
      where: { id, masterId: In(masterIds) },
      relations: ['client', 'service'],
    });
    if (!request) throw new ForbiddenException('Запрос не найден');
    if (request.status !== 'pending') {
      throw new BadRequestException('Запрос уже обработан');
    }

    const masterId = request.masterId;
    const date = request.requestedDate;
    const startTime = (request.requestedStartTime ?? '').slice(0, 5);
    const endTime = (request.requestedEndTime ?? '').slice(0, 5);
    const startMin = this.timeToMinutes(startTime);
    const endMin = this.timeToMinutes(endTime);
    if (startMin >= endMin) {
      throw new BadRequestException('Некорректное время в запросе');
    }

    const existingSlots = await this.slotRepo.find({
      where: { masterId, date },
      select: ['id', 'startTime', 'endTime'],
    });
    for (const s of existingSlots) {
      const sStart = this.timeToMinutes(s.startTime);
      const sEnd = this.timeToMinutes(s.endTime);
      if (this.timeRangesOverlap(startMin, endMin, sStart, sEnd)) {
        throw new BadRequestException('Это время уже занято другим слотом');
      }
    }

    const existingAppointments = await this.appointmentRepo.find({
      where: { masterId, date, status: AppointmentStatus.SCHEDULED },
      relations: ['service'],
    });
    for (const a of existingAppointments) {
      const aStart = this.timeToMinutes(a.startTime);
      const dur = a.service?.durationMinutes ?? 60;
      const aEnd = aStart + dur;
      if (this.timeRangesOverlap(startMin, endMin, aStart, aEnd)) {
        throw new BadRequestException('Это время уже занято другой записью');
      }
    }

    const slot = this.slotRepo.create({
      masterId,
      date,
      startTime,
      endTime,
      isAvailable: true,
      forModels: false,
      serviceId: request.serviceId,
      priceModifier: Number(request.feeAmount),
    });
    const savedSlot = await this.slotRepo.save(slot);

    const appointment = this.appointmentRepo.create({
      clientId: request.clientId,
      serviceId: request.serviceId,
      slotId: savedSlot.id,
      date,
      startTime,
      masterId,
      status: AppointmentStatus.SCHEDULED,
      source: AppointmentSource.SELF,
      reminderEnabled: true,
    });
    const savedAppointment = await this.appointmentRepo.save(appointment);

    request.status = 'accepted' as CustomTimeRequestStatus;
    request.acceptedAt = new Date();
    request.appointmentId = savedAppointment.id;
    await this.requestRepo.save(request);

    await this.notifyClientAccepted(request);

    return {
      request: { id: request.id, status: request.status },
      appointment: { id: savedAppointment.id },
      slot: { id: savedSlot.id },
    };
  }

  private async notifyClientAccepted(request: CustomTimeRequest): Promise<void> {
    const withRelations = await this.requestRepo.findOne({
      where: { id: request.id },
      relations: ['client', 'master', 'service'],
    });
    const client = withRelations?.client;
    const master = withRelations?.master;
    const service = withRelations?.service;
    const telegramId = client?.telegramId?.trim();
    if (!telegramId) return;

    const masterName = master
      ? [master.firstName, master.lastName].filter(Boolean).join(' ').trim() || 'Мастер'
      : 'Мастер';
    const serviceName = service?.name ?? 'Услуга';
    const dateStr = request.requestedDate;
    const timeStr = (request.requestedStartTime ?? '').slice(0, 5);
    const fee = Number(request.feeAmount);
    const text = `✅ Ваше время подтверждено: ${dateStr} ${timeStr}, ${this.escapeHtml(masterName)}, ${serviceName}. Доплата +${fee} €.`;
    await this.botService.sendMessage(telegramId, text);
  }

  async decline(user: User, id: string) {
    const masterIds = await this.getMasterIds(user);
    const request = await this.requestRepo.findOne({
      where: { id, masterId: In(masterIds) },
      relations: ['client'],
    });
    if (!request) throw new ForbiddenException('Запрос не найден');
    if (request.status !== 'pending') {
      throw new BadRequestException('Запрос уже обработан');
    }

    request.status = 'declined' as CustomTimeRequestStatus;
    request.declinedAt = new Date();
    await this.requestRepo.save(request);

    const telegramId = request.client?.telegramId?.trim();
    if (telegramId) {
      const text = 'К сожалению, мастер не может записать вас на выбранное время. Выберите другое время в приложении.';
      await this.botService.sendMessage(telegramId, text);
    }

    return { id: request.id, status: request.status };
  }
}
