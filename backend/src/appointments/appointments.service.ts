import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Client } from '../crm/entities/client.entity';
import { Service } from '../crm/entities/service.entity';
import { Appointment, AppointmentSource, AppointmentStatus } from '../crm/entities/appointment.entity';
import { AvailabilitySlot } from '../crm/entities/availability-slot.entity';
import { BookAppointmentDto } from '../crm/dto/book-appointment.dto';

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

  async getServices(masterId?: string) {
    const resolved = await this.resolveMasterId(masterId);
    return this.serviceRepo.find({
      where: { masterId: resolved },
      order: { name: 'ASC' },
    });
  }

  async getMine(user: User) {
    const masterId = await this.getMasterId();
    const client = await this.clientRepo.findOne({
      where: { telegramId: user.telegramId, masterId },
    });
    if (!client) return [];
    return this.appointmentRepo.find({
      where: { clientId: client.id },
      relations: ['service'],
      order: { date: 'ASC', startTime: 'ASC' },
    });
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
  ): Promise<{ startTime: string; endTime: string; slotId?: string }[]> {
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
    const freeSlots: { startTime: string; endTime: string; slotId?: string }[] = [];

    for (const slot of slots) {
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
          freeSlots.push({ startTime: slotStart, endTime: slotEnd, slotId: slot.id });
        }

        currentMin += 30;
      }
    }

    return freeSlots;
  }

  /** Returns all available slots in a date range (for client booking: choose from master's options only). */
  async getAvailableSlotsInRange(
    serviceId: string,
    fromDate: string,
    toDate: string,
    masterId?: string,
  ): Promise<{ date: string; startTime: string; endTime: string; slotId?: string }[]> {
    const resolved = masterId ? await this.resolveMasterId(masterId) : await this.getMasterId();
    const service = await this.serviceRepo.findOne({
      where: { id: serviceId, masterId: resolved },
    });
    if (!service) throw new BadRequestException('Service not found');

    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (from > to) return [];

    const result: { date: string; startTime: string; endTime: string; slotId?: string }[] = [];
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);

    while (current <= to) {
      const dateStr = current.toISOString().slice(0, 10);
      const daySlots = await this.getAvailableSlotsForDate(dateStr, serviceId, resolved);
      for (const s of daySlots) {
        result.push({ date: dateStr, startTime: s.startTime, endTime: s.endTime, slotId: s.slotId });
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
  async cancelByClient(user: User, appointmentId: string) {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: ['client'],
    });
    if (!appointment) throw new BadRequestException('Appointment not found');
    if (appointment.client?.telegramId !== user.telegramId) {
      throw new ForbiddenException('Only the client who booked can cancel');
    }
    if (appointment.status !== AppointmentStatus.SCHEDULED) {
      throw new BadRequestException('Appointment cannot be cancelled');
    }
    appointment.status = AppointmentStatus.CANCELLED;
    return this.appointmentRepo.save(appointment);
  }
}
