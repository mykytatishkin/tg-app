# Calendar Sync Integration

Мастер открывает страницу «Окошки», нажимает «📅 Синхронизация с календарём», получает приватную ссылку на `.ics` фид. Добавляет её в iOS Calendar или Google Calendar — там появляются все его окошки (свободные и занятые) с автообновлением каждые ~15 минут.

## Зависимости

```bash
cd backend && npm install ical-generator
```

## Что попадает в календарь

| Окошко | Событие | Статус |
|---|---|---|
| Свободное (`isAvailable=true`, без записи) | «Свободно» | `TRANSPARENT` — "свободен" |
| Занятое (есть запись SCHEDULED/DONE) | «Запись — [услуга]» | `CONFIRMED` — "занят" |
| Занятое, запись отменена | «❌ Запись — [услуга]» | `CANCELLED` — исчезает |
| Ручная запись без окошка | «Запись — [услуга]» | `CONFIRMED` — "занят" |

---

## Backend

### 1. `backend/src/auth/entities/user.entity.ts`

Добавить колонку в класс `User`:

```ts
/** Private token for iCal calendar feed. Null until master generates it. */
@Column({ type: 'varchar', nullable: true, unique: true })
calendarToken: string | null;
```

TypeORM с `synchronize: true` (dev) добавит её в БД автоматически при рестарте.

---

### 2. Новый модуль `backend/src/calendar/`

#### `calendar.service.ts`

```ts
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
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Appointment) private appointmentRepo: Repository<Appointment>,
    @InjectRepository(AvailabilitySlot) private slotRepo: Repository<AvailabilitySlot>,
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
          status: In([AppointmentStatus.SCHEDULED, AppointmentStatus.DONE, AppointmentStatus.CANCELLED]),
        },
        relations: ['service'],
        order: { date: 'ASC', startTime: 'ASC' },
      }),
    ]);

    const apptBySlotId = new Map<string, Appointment>();
    const apptWithoutSlot: Appointment[] = [];
    for (const appt of appointments) {
      if (appt.slotId) apptBySlotId.set(appt.slotId, appt);
      else apptWithoutSlot.push(appt);
    }

    const calendar = ical({ name: 'Мои окошки', timezone: TIMEZONE, method: ICalCalendarMethod.PUBLISH });

    for (const slot of slots) {
      const startDate = parseDateTimeInVilnius(slot.date, slot.startTime);
      const endDate = parseDateTimeInVilnius(slot.date, slot.endTime);
      const linkedAppt = apptBySlotId.get(slot.id);

      if (linkedAppt) {
        const isCancelled = linkedAppt.status === AppointmentStatus.CANCELLED;
        const service = linkedAppt.service ?? slot.service;
        const summary = service ? `Запись — ${service.name}` : 'Запись';
        calendar.createEvent({
          id: linkedAppt.id, start: startDate, end: endDate,
          summary: isCancelled ? `❌ ${summary}` : summary,
          status: isCancelled ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
          timezone: TIMEZONE,
        });
      } else if (slot.isAvailable) {
        const label = slot.forModels ? 'Свободно (для моделей)' : 'Свободно';
        const summary = slot.service ? `${label} — ${slot.service.name}` : label;
        calendar.createEvent({
          id: `slot-${slot.id}`, start: startDate, end: endDate, summary,
          status: ICalEventStatus.CONFIRMED,
          transparency: ICalEventTransparency.TRANSPARENT,
          timezone: TIMEZONE,
        });
      }
    }

    for (const appt of apptWithoutSlot) {
      const startDate = parseDateTimeInVilnius(appt.date, appt.startTime);
      const durationMinutes = appt.service?.durationMinutes ?? DEFAULT_DURATION_MINUTES;
      const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
      const isCancelled = appt.status === AppointmentStatus.CANCELLED;
      const summary = appt.service ? `Запись — ${appt.service.name}` : 'Запись';
      calendar.createEvent({
        id: appt.id, start: startDate, end: endDate,
        summary: isCancelled ? `❌ ${summary}` : summary,
        status: isCancelled ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
        timezone: TIMEZONE,
      });
    }

    return calendar.toString();
  }
}
```

#### `calendar.controller.ts`

Публичный эндпоинт — без JWT, токен в URL:

```ts
import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('feed/:token.ics')
  async getFeed(@Param('token') token: string, @Res() res: Response) {
    const icsContent = await this.calendarService.buildIcsFeed(token);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="appointments.ics"');
    res.send(icsContent);
  }
}
```

#### `calendar.module.ts`

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { User } from '../auth/entities/user.entity';
import { Appointment } from '../crm/entities/appointment.entity';
import { AvailabilitySlot } from '../crm/entities/availability-slot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Appointment, AvailabilitySlot])],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
```

---

### 3. `backend/src/app.module.ts`

```ts
import { CalendarModule } from './calendar/calendar.module';

// добавить в imports:
CalendarModule,
```

---

### 4. `backend/src/crm/crm.service.ts`

Добавить импорт вверху файла:
```ts
import { randomUUID } from 'crypto';
```

Добавить два метода в конец класса `CrmService`:

```ts
async getCalendarFeedUrl(user: User, baseUrl: string): Promise<{ feedUrl: string }> {
  let master = await this.userRepo.findOne({ where: { id: user.id } });
  if (!master) throw new ForbiddenException('User not found');
  if (!master.calendarToken) {
    master.calendarToken = randomUUID();
    await this.userRepo.save(master);
  }
  return { feedUrl: `${baseUrl}/api/calendar/feed/${master.calendarToken}.ics` };
}

async regenerateCalendarToken(user: User, baseUrl: string): Promise<{ feedUrl: string }> {
  const master = await this.userRepo.findOne({ where: { id: user.id } });
  if (!master) throw new ForbiddenException('User not found');
  master.calendarToken = randomUUID();
  await this.userRepo.save(master);
  return { feedUrl: `${baseUrl}/api/calendar/feed/${master.calendarToken}.ics` };
}
```

---

### 5. `backend/src/crm/crm.controller.ts`

Добавить импорт:
```ts
import type { Request as ExpressRequest } from 'express';
```

Добавить три метода в конец класса `CrmController`:

```ts
@Get('calendar/feed-url')
getCalendarFeedUrl(@Request() req: { user: User } & ExpressRequest) {
  return this.crmService.getCalendarFeedUrl(req.user, this.resolveBaseUrl(req));
}

@Post('calendar/regenerate-token')
regenerateCalendarToken(@Request() req: { user: User } & ExpressRequest) {
  return this.crmService.regenerateCalendarToken(req.user, this.resolveBaseUrl(req));
}

private resolveBaseUrl(req: ExpressRequest): string {
  // Priority: BACKEND_URL → MINI_APP_URL (ngrok proxies /api to backend) → request headers
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
  if (process.env.MINI_APP_URL) {
    try { return new URL(process.env.MINI_APP_URL).origin; } catch { /* ignore */ }
  }
  const proto = (req.get('x-forwarded-proto') as string) || req.protocol;
  const host = (req.get('x-forwarded-host') as string) || req.get('host');
  return `${proto}://${host}`;
}
```

---

### 6. `backend/.env.example`

```env
# Public URL of the backend API (used for calendar feed links).
# If not set, falls back to MINI_APP_URL origin (when Vite proxies /api to backend).
BACKEND_URL=https://your-domain.com
```

---

## Frontend

### 7. `frontend/src/api/client.js`

Добавить в конец файла:

```js
export const calendarApi = {
  getFeedUrl: () => api.get('/crm/calendar/feed-url'),
  regenerateToken: () => api.post('/crm/calendar/regenerate-token'),
};
```

---

### 8. `frontend/src/views/admin/Availability.vue`

#### В `<script setup>` — добавить импорт:

```js
import { api, calendarApi } from '../../api/client';
```

#### В `<script setup>` — добавить в конец перед `onMounted`:

```js
// ── Calendar sync ──────────────────────────────────────────────────────────
const calendarSectionOpen = ref(false);
const calendarFeedUrl = ref('');
const calendarLoading = ref(false);
const calendarError = ref(null);
const calendarCopied = ref(false);

async function openCalendarSection() {
  calendarSectionOpen.value = !calendarSectionOpen.value;
  if (calendarSectionOpen.value && !calendarFeedUrl.value) await loadCalendarFeedUrl();
}

async function loadCalendarFeedUrl() {
  calendarLoading.value = true;
  calendarError.value = null;
  try {
    const data = await calendarApi.getFeedUrl();
    calendarFeedUrl.value = data.feedUrl;
  } catch (e) {
    calendarError.value = e.message;
  } finally {
    calendarLoading.value = false;
  }
}

async function doRegenerateCalendarToken() {
  if (!confirm('Старая ссылка перестанет работать. Продолжить?')) return;
  calendarLoading.value = true;
  calendarError.value = null;
  try {
    const data = await calendarApi.regenerateToken();
    calendarFeedUrl.value = data.feedUrl;
    hapticFeedback?.('success');
  } catch (e) {
    calendarError.value = e.message;
  } finally {
    calendarLoading.value = false;
  }
}

async function copyFeedUrl() {
  if (!calendarFeedUrl.value) return;
  try {
    await navigator.clipboard.writeText(calendarFeedUrl.value);
    calendarCopied.value = true;
    setTimeout(() => { calendarCopied.value = false; }, 2000);
    hapticFeedback?.('light');
  } catch { /* ignore */ }
}

function openInIosCalendar() {
  window.open(calendarFeedUrl.value.replace(/^https?:\/\//, 'webcal://'), '_blank');
}

function openInGoogleCalendar() {
  window.open(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarFeedUrl.value)}`, '_blank');
}
// ───────────────────────────────────────────────────────────────────────────
```

#### В `<template>` — вставить после подсказки про 60 дней, перед `<div v-if="!showForm"`:

```html
<!-- Calendar sync (masters only) -->
<div v-if="!isAdmin" class="mb-6">
  <button
    type="button"
    class="w-full flex items-center justify-between py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)]"
    @click="openCalendarSection"
  >
    <span>📅 Синхронизация с календарём</span>
    <span class="text-[var(--tg-theme-hint-color,#999)] text-sm">{{ calendarSectionOpen ? '▲' : '▼' }}</span>
  </button>

  <div v-if="calendarSectionOpen" class="mt-3 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] space-y-4">
    <p class="text-sm text-[var(--tg-theme-hint-color,#999)]">
      Подпишитесь на приватную ссылку — iOS Calendar или Google Calendar автоматически будет показывать все ваши окошки и записи.
    </p>

    <div v-if="calendarLoading" class="text-sm text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>
    <div v-else-if="calendarError" class="text-sm text-red-400">{{ calendarError }}</div>

    <template v-else-if="calendarFeedUrl">
      <div class="flex gap-2">
        <input
          :value="calendarFeedUrl" readonly
          class="flex-1 p-3 rounded-lg text-xs bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] truncate"
          @focus="($event.target).select()"
        />
        <button
          type="button"
          class="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
          @click="copyFeedUrl"
        >{{ calendarCopied ? '✓' : 'Копировать' }}</button>
      </div>

      <div class="flex gap-2">
        <button type="button"
          class="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
          @click="openInIosCalendar">iOS Calendar</button>
        <button type="button"
          class="flex-1 py-2 px-3 rounded-lg text-sm font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
          @click="openInGoogleCalendar">Google Calendar</button>
      </div>

      <div class="text-xs text-[var(--tg-theme-hint-color,#999)] space-y-1">
        <p><strong>iOS:</strong> Нажмите «iOS Calendar» — телефон спросит подтверждение. Или вручную: Настройки → Приложения → Календарь → Учётные записи → Добавить → Другие → Подписка на календарь.</p>
        <p><strong>Google:</strong> Нажмите «Google Calendar». Обновление у Google раз в ~24ч, у iOS — каждые ~15 мин.</p>
      </div>

      <button type="button"
        class="w-full py-2 rounded-lg text-sm text-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)]"
        :disabled="calendarLoading"
        @click="doRegenerateCalendarToken">
        Обновить ссылку (старая перестанет работать)
      </button>
    </template>
  </div>
</div>
```

---

## Переменные окружения

| Переменная | Обязательная | Описание |
|---|---|---|
| `MINI_APP_URL` | Уже есть | Используется как базовый URL фида если `BACKEND_URL` не задан |
| `BACKEND_URL` | Нет | Явный override для продакшна с отдельным доменом бэкенда |

## Примечания

- Токен генерируется лениво — при первом запросе feed-url
- Кнопка «Обновить ссылку» делает новый UUID — старая подписка перестаёт работать
- Google Calendar кэширует внешние фиды и обновляет раз в ~24 часа — это его ограничение
- iOS Calendar обновляет каждые ~15 минут
- Слоты с `isAvailable=false` в фид не попадают (заблокированное время)
