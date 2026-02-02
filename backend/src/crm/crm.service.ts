import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { Service } from './entities/service.entity';
import { AvailabilitySlot } from './entities/availability-slot.entity';
import { Appointment, AppointmentStatus, AppointmentSource } from './entities/appointment.entity';
import { User } from '../auth/entities/user.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { BotService } from '../bot/bot.service';

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
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private botService: BotService,
  ) {}

  private async getMasterId(user: User): Promise<string> {
    if (user.isMaster) return user.id;
    const master = await this.userRepo.findOne({ where: { isMaster: true } });
    if (!master) throw new ForbiddenException('No master configured');
    return master.id;
  }

  async getClients(user: User) {
    const masterId = await this.getMasterId(user);
    const clients = await this.clientRepo.find({
      where: { masterId },
      order: { name: 'ASC' },
      relations: ['appointments'],
    });
    return clients.map((c) => {
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
  }

  async createClient(user: User, dto: CreateClientDto) {
    const masterId = await this.getMasterId(user);
    const client = this.clientRepo.create({ ...dto, masterId });
    return this.clientRepo.save(client);
  }

  async getClient(user: User, id: string) {
    const masterId = await this.getMasterId(user);
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
    const stats = {
      totalVisits: doneOrScheduled.length,
      lastVisitAt: lastVisit ? lastVisit.toISOString() : null,
      byService: Array.from(byServiceMap.values()).sort((a, b) => b.count - a.count),
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
    await this.clientRepo.update({ id, masterId }, dto);
    return this.getClient(user, id);
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
      .where('slot.masterId = :masterId', { masterId })
      .orderBy('slot.date', 'ASC')
      .addOrderBy('slot.startTime', 'ASC');
    if (from) qb.andWhere('slot.date >= :from', { from });
    if (to) qb.andWhere('slot.date <= :to', { to });
    return qb.getMany();
  }

  async createAvailability(user: User, dto: CreateAvailabilityDto) {
    const masterId = await this.getMasterId(user);
    const slot = this.slotRepo.create({
      ...dto,
      masterId,
      isAvailable: dto.isAvailable ?? true,
    });
    return this.slotRepo.save(slot);
  }

  async updateAvailability(user: User, id: string, dto: UpdateAvailabilityDto) {
    const masterId = await this.getMasterId(user);
    await this.slotRepo.update({ id, masterId }, dto);
    return this.slotRepo.findOne({ where: { id, masterId } });
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
      .orderBy('a.date', 'ASC')
      .addOrderBy('a.startTime', 'ASC');
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
      relations: ['client', 'service'],
    });
    if (!appointment) throw new ForbiddenException('Appointment not found');
    return appointment;
  }

  async updateAppointment(user: User, id: string, dto: UpdateAppointmentDto) {
    const masterId = await this.getMasterId(user);
    const previous = await this.appointmentRepo.findOne({
      where: { id, masterId },
      relations: ['client', 'service'],
    });
    await this.appointmentRepo.update({ id, masterId }, dto);
    const updated = await this.getAppointment(user, id);
    if (dto.status === AppointmentStatus.CANCELLED && previous?.client?.telegramId) {
      const dateTimeStr = `${previous.date} ${previous.startTime}`;
      const serviceName = previous.service?.name ?? '';
      const text = `❌ Ваша запись отменена мастером: ${dateTimeStr}${serviceName ? `, ${serviceName}` : ''}.`;
      await this.botService.sendMessage(previous.client.telegramId, text);
    }
    return updated;
  }

  async deleteAppointment(user: User, id: string) {
    const masterId = await this.getMasterId(user);
    const result = await this.appointmentRepo.delete({ id, masterId });
    if (result.affected === 0) throw new ForbiddenException('Appointment not found');
  }

  /** Statistics: services with booking count, total appointments, clients count. */
  async getStats(user: User) {
    const masterId = await this.getMasterId(user);
    const appointments = await this.appointmentRepo.find({
      where: { masterId },
      relations: ['service'],
    });
    const doneOrScheduled = appointments.filter(
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
    const clientIds = new Set(doneOrScheduled.map((a) => a.clientId));
    const clientsCount = await this.clientRepo.count({ where: { masterId } });
    return {
      totalAppointments: doneOrScheduled.length,
      totalClients: clientsCount,
      byService: Array.from(byServiceMap.values()).sort((a, b) => b.count - a.count),
    };
  }
}
