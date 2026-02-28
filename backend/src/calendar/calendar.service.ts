import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Appointment, AppointmentStatus } from '../crm/entities/appointment.entity';
import { AvailabilitySlot } from '../crm/entities/availability-slot.entity';
import ical, { ICalCalendarMethod, ICalEventStatus, ICalEventTransparency } from 'ical-generator';
import { parseDateTimeInVilnius } from '../shared/timezone.util';

const TIMEZONE = 'Europe/Vilnius';
const DEFAULT_DURATION_MINUTES = 60;

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(AvailabilitySlot)
    private slotRepo: Repository<AvailabilitySlot>,
  ) {}

  async buildIcsFeed(token: string): Promise<string> {
    const master = await this.userRepo.findOne({ where: { calendarToken: token } });
    if (!master) throw new NotFoundException('Calendar feed not found');

    const [slots, appointments] = await Promise.all([
      this.slotRepo.find({
        where: { masterId: master.id },
        relations: ['service'],
        order: { date: 'ASC', startTime: 'ASC' },
      }),
      this.appointmentRepo.find({
        where: {
          masterId: master.id,
          status: In([
            AppointmentStatus.SCHEDULED,
            AppointmentStatus.DONE,
            AppointmentStatus.CANCELLED,
          ]),
        },
        relations: ['service'],
        order: { date: 'ASC', startTime: 'ASC' },
      }),
    ]);

    // Map slotId → appointment for quick lookup
    const apptBySlotId = new Map<string, Appointment>();
    const apptWithoutSlot: Appointment[] = [];
    for (const appt of appointments) {
      if (appt.slotId) {
        apptBySlotId.set(appt.slotId, appt);
      } else {
        apptWithoutSlot.push(appt);
      }
    }

    const calendar = ical({
      name: 'Мои окошки',
      timezone: TIMEZONE,
      method: ICalCalendarMethod.PUBLISH,
    });

    // 1. All availability slots
    for (const slot of slots) {
      const startDate = parseDateTimeInVilnius(slot.date, slot.startTime);
      const endDate = parseDateTimeInVilnius(slot.date, slot.endTime);

      const linkedAppt = apptBySlotId.get(slot.id);

      if (linkedAppt) {
        // Slot is booked — show as appointment event
        const isCancelled = linkedAppt.status === AppointmentStatus.CANCELLED;
        const service = linkedAppt.service ?? slot.service;
        const summary = service ? `Запись — ${service.name}` : 'Запись';

        calendar.createEvent({
          id: linkedAppt.id,
          start: startDate,
          end: endDate,
          summary: isCancelled ? `❌ ${summary}` : summary,
          status: isCancelled ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
          timezone: TIMEZONE,
        });
      } else if (slot.isAvailable) {
        // Slot is free — show as a free window
        const label = slot.forModels ? 'Свободно (для моделей)' : 'Свободно';
        const summary = slot.service ? `${label} — ${slot.service.name}` : label;

        calendar.createEvent({
          id: `slot-${slot.id}`,
          start: startDate,
          end: endDate,
          summary,
          status: ICalEventStatus.CONFIRMED,
          timezone: TIMEZONE,
          transparency: ICalEventTransparency.TRANSPARENT, // shows as "free" in calendar apps
        });
      }
      // isAvailable=false slots are intentionally skipped (blocked time, not relevant)
    }

    // 2. Manual appointments without a linked slot
    for (const appt of apptWithoutSlot) {
      const startDate = parseDateTimeInVilnius(appt.date, appt.startTime);
      const durationMinutes = appt.service?.durationMinutes ?? DEFAULT_DURATION_MINUTES;
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

      const isCancelled = appt.status === AppointmentStatus.CANCELLED;
      const summary = appt.service ? `Запись — ${appt.service.name}` : 'Запись';

      calendar.createEvent({
        id: appt.id,
        start: startDate,
        end: endDate,
        summary: isCancelled ? `❌ ${summary}` : summary,
        status: isCancelled ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
        timezone: TIMEZONE,
      });
    }

    return calendar.toString();
  }
}
