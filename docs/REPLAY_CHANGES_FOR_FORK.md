# Инструкция по повторению изменений на форке приложения

Документ описывает все изменения, которые нужно внести в форк приложения (с другим дизайном), чтобы повторить функциональность. Пути к файлам даны относительно корня репозитория (backend/ и frontend/). Адаптируй классы/стили под свой дизайн, сохраняя логику.

---

## 1. Кликабельный тег клиента в Telegram-уведомлениях мастеру

При уведомлении мастера о новой записи или отмене клиент отображается как ссылка `tg://user?id=...`, по которой можно перейти в профиль в Telegram.

### 1.1 backend/src/appointments/appointments.service.ts

**В методе `notifyMasterOnNewBooking`** (формирование текста уведомления о новой записи):

Было (примерно):
```ts
const clientName = client.name ?? 'Клиент';
const clientUsername = client.username?.trim();
const mention = clientUsername ? `@${clientUsername}` : this.escapeHtml(clientName);
```

Заменить на:
```ts
const clientName = client.name ?? 'Клиент';
const clientUsername = client.username?.trim();
const clientTgId = client.telegramId?.trim();
const mention = clientTgId
  ? `<a href="tg://user?id=${clientTgId}">${this.escapeHtml(clientName)}</a>`
  : clientUsername
    ? `@${clientUsername}`
    : this.escapeHtml(clientName);
```

**В методе `cancelByClient`** (уведомление мастеру об отмене клиентом):

Было (примерно):
```ts
const clientName = appointment.client?.name ?? 'Клиент';
const clientUsername = appointment.client?.username?.trim();
const mention = clientUsername ? `@${clientUsername}` : clientName;
const serviceName = appointment.service?.name ?? '';
const text = `❌ Клиент отменил запись: ... Причина: ${reasonText}`;
```

Заменить на:
```ts
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
```
(Убедись, что в строке `text` услуга и причина отмены проходят через `this.escapeHtml`, т.к. сообщение уходит с `parse_mode: 'HTML'`.)

### 1.2 backend/src/crm/crm.service.ts

**В методе `notifyMasterOnNewAppointment`** (уведомление о новой записи из CRM):

Было (примерно):
```ts
const clientName = full.client?.name ?? 'Клиент';
const text = `📅 Новая запись: ... Клиент: ${this.escapeHtml(clientName)}`;
```

Заменить на:
```ts
const clientName = full.client?.name ?? 'Клиент';
const serviceName = full.service?.name ?? '—';
const clientTgId = full.client?.telegramId?.trim();
const linkToClient = clientTgId
  ? `<a href="tg://user?id=${clientTgId}">${this.escapeHtml(clientName)}</a>`
  : this.escapeHtml(clientName);
const text = `📅 Новая запись: ${dateStr} ${timeStr}, ${this.escapeHtml(serviceName)}. Клиент: ${linkToClient}`;
```

---

## 2. Порядок слотов: только для мастера — от новых дат к старым

Клиенты по-прежнему видят слоты от старых дат к новым. Мастер в админке «Доступность» видит слоты от новых дат к старым.

### 2.1 backend/src/crm/crm.service.ts

**В методе `getAvailability`** (запрос слотов для мастера/админа):

В `createQueryBuilder` заменить порядок с:
```ts
.orderBy('slot.date', 'ASC')
.addOrderBy('slot.startTime', 'ASC');
```
на:
```ts
.orderBy('slot.date', 'DESC')
.addOrderBy('slot.startTime', 'ASC');
```

Важно: не менять порядок в `getAvailableSlotsInRange` и `getAvailableModelSlotsInRange` в appointments.service.ts — там клиенты получают слоты, порядок должен остаться «от старых к новым».

---

## 3. Цветовая подсветка слотов в «Доступность» по дате

Слоты с датой в прошлом — красная полоска, с датой в ближайшие 3 дня (сегодня/завтра/послезавтра) — зелёная, остальные — без подсветки.

### 3.1 backend

Изменений в backend нет.

### 3.2 frontend/src/views/admin/Availability.vue

**Добавить функцию** (в `<script setup>`, рядом с другими утилитами):
```js
/** 'past' = дата раньше сегодня → красный, 'soon' = в ближайшие 3 дня (включительно) → зелёный, иначе без подсветки */
function getSlotDateClass(dateStr) {
  if (!dateStr) return null;
  const y = (d) => d.getFullYear();
  const m = (d) => String(d.getMonth() + 1).padStart(2, '0');
  const day = (d) => String(d.getDate()).padStart(2, '0');
  const toStr = (d) => `${y(d)}-${m(d)}-${day(d)}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toStr(today);
  if (dateStr < todayStr) return 'past';
  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 2);
  const in3DaysStr = toStr(in3Days);
  if (dateStr <= in3DaysStr) return 'soon';
  return null;
}
```

**В списке слотов** (`<li v-for="s in slots">`): добавить к элементу классы левой границы и опциональную полупрозрачность. Пример (адаптируй под свои классы):
- К корневому классу `li` добавить: `border-l-4` (или аналог).
- В `:class` добавить:
  - `getSlotDateClass(s.date) === 'past' && 'border-red-500'` (или твой класс для красной границы),
  - `getSlotDateClass(s.date) === 'soon' && 'border-green-500'`,
  - `getSlotDateClass(s.date) == null && 'border-transparent'`.

---

## 4. Занятые слоты: полупрозрачность и подпись «кто занял»

В «Доступность» занятые слоты отображать полупрозрачными и с текстом вида «Занят: Имя клиента».

### 4.1 backend/src/crm/crm.service.ts

**В методе `getAvailability`:**

1. При загрузке записей (appointments) добавить в `relations` сущность `'client'`:
   ```ts
   relations: ['service', 'client'],
   ```

2. В ветке «нет слотов / нет дат» при возврате слотов добавлять к каждому объекту: `bookedBy: null as string | null`.

3. В цикле по слотам вместо простого флага `isBooked` и набора `bookedSlotIds`:
   - Для слотов `forModels`: найти запись с `a.slotId === slot.id`; если есть — `isBooked = true`, `bookedBy = booking.client?.name?.trim() ?? 'Клиент'`.
   - Для обычных слотов: оставить логику пересечения по времени с записями; для первой подходящей записи взять `bookedBy = booking.client?.name?.trim() ?? 'Клиент'`.
   - Возвращать объект слота с полями `...slot, isBooked, bookedBy`.

4. Для слотов вне диапазона fromDate–toDate возвращать `{ ...slot, isBooked: false, bookedBy: null as string | null }`.

### 4.2 frontend/src/views/admin/Availability.vue

**В карточке слота:**
- Для занятых слотов добавить класс/стиль полупрозрачности, например `opacity-60` (или твой вариант): `{ 'opacity-60': s.isBooked }`.
- В месте, где выводится «Занят», изменить на: «Занят» и при наличии `s.bookedBy` вывести «: {{ s.bookedBy }}» (например, `<span v-if="s.isBooked"> — Занят<template v-if="s.bookedBy">: {{ s.bookedBy }}</template></span>`).

---

## 5. Клиенты: поиск и сортировка (бэкенд)

Поиск по подстроке в имени, нике мастера (masterNickname), инстаграме, телефоне, username. Сортировка: по последней записи, по первой записи (регистрация у мастера), по алфавиту.

### 5.1 backend/src/crm/crm.service.ts

**Сигнатура `getClients`:**
```ts
async getClients(
  user: User,
  filterMasterId?: string,
  search?: string,
  sort?: 'lastVisit' | 'firstVisit' | 'name',
) {
```

**В маппинге клиентов** (где считаешь `lastVisit` по записям): дополнительно вычислить `firstVisit` — минимум по дате+времени среди тех же записей (DONE/SCHEDULED). Добавить в возвращаемый объект поля:
- `firstVisitAt: firstVisit ? firstVisit.toISOString() : null`.

**Для «зарегистрированных без записей»** (если такие есть в ответе): в объект добавить `firstVisitAt: null`.

**После формирования полного списка `list`:**
1. Фильтрация по `search`: если `search?.trim()` есть, отфильтровать `list` по подстроке (без учёта регистра) по полям: name, masterNickname, instagram, phone, username (для @ — искать без @ в username). Результат положить в переменную `filtered`.
2. Сортировка `filtered`:
   - при `sort === 'lastVisit'`: по `lastVisitAt` DESC (без даты — в конец);
   - при `sort === 'firstVisit'`: по `firstVisitAt` ASC (без даты — в конец или по имени);
   - при `sort === 'name'` или по умолчанию: по `name` localeCompare 'ru'.
3. Вернуть `filtered` (а не `list`).

### 5.2 backend/src/crm/crm.controller.ts

**GET `clients`:** добавить query-параметры `search` и `sort`. Вызывать `getClients(req.user, masterId || undefined, search?.trim() || undefined, sortOption)`. Значение `sort` передавать только если это одно из: `'lastVisit'`, `'firstVisit'`, `'name'`.

---

## 6. Клиенты: поиск и сортировка (фронтенд)

В экране списка клиентов (мастер или админ с выбранным мастером) — поле поиска и выбор сортировки.

### 6.1 frontend/src/views/admin/Clients.vue

**Состояние:**
- `clientSearch = ref('')`;
- `clientSort = ref('lastVisit')`; // варианты: 'lastVisit' | 'firstVisit' | 'name'
- таймер для debounce поиска (например `let searchDebounce = null`).

**Функция загрузки клиентов:** при формировании URL добавлять query-параметры: `search` (если строка не пустая), `sort` (текущее значение `clientSort`). Вызывать API с этим URL.

**Функция по вводу в поле поиска:** debounce ~400 ms, затем вызвать загрузку клиентов с текущими `masterId`/контекстом.

**В шаблоне (только для блока «Список клиентов»):**
- Поле ввода поиска: `v-model="clientSearch"`, placeholder про имя/ник/инстаграм/телефон, по `@input` вызывать функцию с debounce.
- Блок сортировки: подпись «Сортировка» и один `<select>` с `v-model="clientSort"`, опции: `lastVisit` — «По последней записи», `firstVisit` — «По первой записи», `name` — «По алфавиту». По `@change` вызывать загрузку клиентов.

Стили (rounded-xl, отступы, цвета) можно заменить на свои, сохранив логику и структуру.

---

## 7. Счётчики и фильтры типа клиентов

### 7.1 frontend/src/views/admin/Clients.vue

**Для админов (все пользователи):** добавить вычисляемые свойства `registeredCount`, `mastersCount`, `adminsCount` — отображать их в шапке списка. Добавить `roleFilter` ref и кнопки фильтрации «Все / Только админы / Только мастера».

**Для мастеров (клиенты):** добавить вычисляемые свойства:
- `totalUsersCount` — длина `clients` массива
- `clientsCount` — клиенты с `visitCount > 0` или `firstVisitAt`
- `noOrderCount` — остальные

Добавить `clientTypeFilter` ref (`'all'` | `'clients'` | `'users'`) и кнопки фильтрации. Каждая карточка клиента показывает бейдж «Клиент» или «Без заказов».

**Для админов (все пользователи):** `userSearch` ref и `userSort` ref, с `<input>` поиска и `<select>` сортировки. Сортировка: «По алфавиту», «Сначала админы», «Сначала мастера».

---

## 8. Статистика мастера: новые пользователи, bar chart, кликабельные панели

### 8.1 backend/src/crm/crm.service.ts

**В методе `getStats`:** добавить вычисление `newUsersByMonth` — для каждого месяца считать сколько клиентов `createdAt` попадает в этот месяц (`registered`), и сколько из них имеют хотя бы одну запись (`madeOrder`). Добавить в возвращаемый объект `newUsersByMonth`.

**В методе `getAppointments`:** добавить relation `'feedback'` чтобы в записях были данные отзывов. Принимать query-параметры `from` и `to` для фильтрации.

### 8.2 frontend/src/views/admin/Stats.vue

1. **Новые пользователи / новые клиенты:** для каждого месяца отображать «Зарегистрировалось: N · Сделали заказ: M» + CSS pie chart через `conic-gradient`.

2. **Записи по сервисам:** заменить список на горизонтальный bar chart — ширина каждого бара пропорциональна `count / max`.

3. **Кликабельные панели:** все 4 панели статистики обёрнуты в `<button>` / `@click`. При клике на «Всего записей» открывается модальное окно со списком записей, сгруппированных по дате. Каждая карточка записи: время, финальная сумма, оценка, статус, примечание, тип услуги.

---

## 9. Post-session flow: бот спрашивает мастера «Завершили приём?»

### 9.1 Изменения в entities

**backend/src/crm/entities/client.entity.ts** — новое поле:
```ts
@Column({ type: 'int', default: 0 })
noShowCount: number;
```

**backend/src/crm/entities/appointment.entity.ts** — новые статусы и поле:
```ts
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  DONE = 'done',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
}

// В классе Appointment:
@Column({ type: 'timestamp', nullable: true })
postSessionSentAt: Date | null;
```

### 9.2 backend/src/appointments/post-session.service.ts (новый файл)

Cron-сервис, запускается каждые 5 минут. Ищет записи со статусом `SCHEDULED`, `postSessionSentAt IS NULL`, дата не старше 30 дней, у которых время приёма + длительность услуги < now. Для каждой отправляет мастеру вопрос через `botService.sendPostSessionQuestion(...)`, проставляет `postSessionSentAt = now`. Между сообщениями пауза 500ms для Telegram rate limits.

### 9.3 backend/src/bot/bot.service.ts

**Новый метод `sendPostSessionQuestion`:**
```ts
async sendPostSessionQuestion(
  masterChatId: string,
  appointmentId: string,
  clientName: string,
  date: string | Date,
  startTime: string,
  serviceName: string | null,
): Promise<boolean>
```
Отправляет сообщение с inline-кнопками `[Да] [Нет]` (callback_data: `ps_yes_{id}`, `ps_no_{id}`).

**Обработчики inline-кнопок:**
- `ps_yes_{id}` → статус `DONE`, ответ «Приём отмечен как завершённый»
- `ps_no_{id}` → показать меню причин: `[Перенос] [Отменено] [Клиент не пришёл]`
- `ps_reason_{id}_reschedule` → статус `RESCHEDULED`, клиенту отправить кнопку «Записаться»
- `ps_reason_{id}_cancel` → статус `CANCELLED`, `cancelledBy = 'master'`
- `ps_reason_{id}_noshow` → статус `NO_SHOW`, `client.noShowCount += 1`, если > 2 — предупреждение «ненадёжный»

**Зависимости:** добавить `@InjectRepository(Client)` в BotService, добавить `Client` в BotModule imports.

### 9.4 backend/src/appointments/appointments.module.ts

Зарегистрировать `PostSessionService` в `providers`.

### 9.5 backend/src/appointments/appointments.service.ts — noShow в уведомлении

**В методе `notifyMasterOnNewBooking`:** после формирования `mention` добавить:
```ts
const noShowPart = (client.noShowCount ?? 0) > 0
  ? `\n⚠️ Пропусков без отмены: ${client.noShowCount}${client.noShowCount > 2 ? ' (ненадёжный клиент)' : ''}`
  : '';
```
И добавить `${noShowPart}` в конец текста сообщения.

### 9.6 frontend/src/views/admin/Clients.vue — бейдж «Ненадёжный»

В карточке клиента: если `c.noShowCount > 2` — красный бейдж «Ненадёжный (N)». Если `c.noShowCount > 0` — текст «пропусков: N» красным цветом в строке статистики.

### 9.7 frontend/src/views/admin/ClientDetail.vue — бейдж + noShow

1. **В верхней карточке клиента** (рядом с именем/контактами): если `client.noShowCount > 0` — inline-бейдж:
   - `noShowCount > 2` → красный бейдж «Ненадёжный: N»
   - `noShowCount` 1–2 → жёлтый бейдж «Пропуски: N»

2. **Перед блоком статистики:** если `client.noShowCount > 2` — красная плашка «Ненадёжный клиент — пропусков: N». Если `noShowCount > 0` но <= 2 — серая плашка с количеством.

3. **В блоке статистики:** вместо подписи «LTV» писать «Потрачено в сумме».

---

## 10. LTV клиента

### 10.1 backend/src/crm/crm.service.ts

**В `getClients`:** загружать `relations: ['appointments', 'appointments.service']`. Для каждого клиента считать LTV = сумма `finalPrice ?? service.price` по записям со статусом DONE. Добавлять `ltv` в ответ. Для pseudo-клиентов (зарегистрированных без записей) — `ltv: 0`.

**В `getClient`:** аналогично считать `ltv` и `ltvByService: { serviceName, total }[]`. Добавить в объект `stats`.

### 10.2 backend/src/appointments/appointments.service.ts

**Новый метод `getMyStats(user)`:** для каждого мастера, у которого клиент записывался, возвращает:
```ts
{ totalSpent, byMaster: [{ masterName, totalSpent, appointmentCount, byService: [{ name, total }] }] }
```

**Новый endpoint** `GET /appointments/my-stats` в appointments.controller.ts.

### 10.3 frontend/src/views/admin/Clients.vue

В карточке клиента: если `c.ltv > 0` — строка «LTV: XX.XX €».

### 10.4 frontend/src/views/admin/ClientDetail.vue

В блоке статистики: рядом с «Всего визитов» показывать LTV. Отдельный блок «Сколько потратил — по услугам» с `ltvByService`.

### 10.5 frontend/src/views/Profile.vue

Загружать `GET /appointments/my-stats`. Если `totalSpent > 0` — блок «Моя статистика»: общие траты, разбивка по мастерам и услугам.

---

## 11. Любимые дни и время (профиль клиента)

### 11.1 backend/src/auth/entities/user.entity.ts

Новые поля:
```ts
@Column({ type: 'json', nullable: true })
favoriteDays: number[] | null;

@Column({ type: 'json', nullable: true })
favoriteTimeBuckets: string[] | null;
```

### 11.2 backend/src/appointments/appointments.service.ts

**`getMyProfile`:** дополнительно возвращать `favoriteDays` и `favoriteTimeBuckets` из User entity.

**`updateMyProfile`:** расширить сигнатуру — принимать `body: { instagram?, favoriteDays?, favoriteTimeBuckets? }`. Сохранять новые поля в User entity через `userRepo.update(...)`.

### 11.3 backend/src/appointments/appointments.controller.ts

`PATCH /appointments/profile` — передавать `body` целиком (с `favoriteDays` и `favoriteTimeBuckets`).

### 11.4 frontend/src/views/Profile.vue

Добавить состояние:
- `favoriteDays = ref([])`, `favoriteTimeBuckets = ref([])`, `savingPrefs = ref(false)`
- Константы `DAY_LABELS` (Пн–Вс, значения 0–6) и `TIME_LABELS` (Утро/День/Вечер, значения morning/afternoon/evening)

В шаблоне (внутри блока `v-else-if="profile"`, после формы Instagram):
- Блок «Любимые дни» — 7 toggle-кнопок (Пн–Вс), множественный выбор
- Блок «Любимое время» — 3 toggle-кнопки, множественный выбор
- Кнопка «Сохранить предпочтения» → `PATCH /appointments/profile` с `favoriteDays` и `favoriteTimeBuckets`

### 11.5 backend/src/crm/client-reminders.service.ts

**В `sendSmartReminderWithSlots`:** перед анализом истории записей — проверить `user.favoriteDays` и `user.favoriteTimeBuckets` (из `userRepo`). Если ручные предпочтения заданы — использовать их для `preferredWeekdays` и `preferredTimeBuckets`. Если пустые — fallback на анализ истории (как было).

Добавить `@InjectRepository(User)` в конструктор и `import { User }`.

---

## 12. Клиенты не видят прошедшие даты/слоты при записи

### 12.1 backend/src/appointments/appointments.service.ts

Добавить import:
```ts
import { getTodayInVilnius, parseDateTimeInVilnius } from '../shared/timezone.util';
```

**В `getAvailableSlotsInRange`:** перед итерацией по дням — вычислить `todayStr = getTodayInVilnius()`, если `fromDate < todayStr` — начать с `todayStr`.

**В `getAvailableSlotsForDate`:** определить `isToday = (date === getTodayInVilnius())`. В цикле генерации слотов, если `isToday` и `parseDateTimeInVilnius(date, slotStart) <= now` — пропустить слот (`continue`).

**В `getAvailableModelSlotsInRange`:** аналогично — пропускать слоты с `date < todayStr`, а для `date === todayStr` пропускать слоты с `startTime` в прошлом.

---

## Миграция БД

Одна миграция (или `synchronize: true` в dev):
```sql
ALTER TABLE clients ADD COLUMN "noShowCount" int DEFAULT 0;
ALTER TABLE appointments ADD COLUMN "postSessionSentAt" timestamp NULL;
ALTER TABLE users ADD COLUMN "favoriteDays" json NULL;
ALTER TABLE users ADD COLUMN "favoriteTimeBuckets" json NULL;
```
Новые значения статусов `'no_show'` и `'rescheduled'` — просто строки в varchar-колонке, миграция не нужна.

---

## Чек-лист для проверки на форке

- [ ] Уведомление «Новая запись» мастеру в Telegram — клиент кликабельный (tg://user).
- [ ] Уведомление «Клиент отменил запись» — клиент кликабельный, причина в HTML экранирована.
- [ ] Новая запись из CRM — в уведомлении мастеру клиент ссылкой.
- [ ] В админке «Доступность» слоты идут от новых дат к старым; у клиентов порядок слотов не менялся.
- [ ] В «Доступность» слоты: красная полоска — прошедшая дата, зелёная — ближайшие 3 дня.
- [ ] Занятые слоты полупрозрачные и с подписью «Занят: Имя».
- [ ] GET /crm/clients принимает `search` и `sort`, возвращает firstVisitAt, фильтрация и сортировка работают.
- [ ] В «Клиенты» есть поле поиска (с debounce) и выпадающий список сортировки, запрос уходит с параметрами.
- [ ] Счётчики (зарег./мастеров/админов; пользователей/клиентов/без заказов) отображаются.
- [ ] Фильтры по типу клиента (все/клиенты/без заказов) и ролям (для админов) работают.
- [ ] Статистика мастера: pie chart новых пользователей, bar chart по сервисам, кликабельные панели.
- [ ] Модальное окно с записями при клике на «Всего записей» — группировка по дате, карточки с деталями.
- [ ] Post-session: бот спрашивает мастера после сеанса, кнопки Да/Нет, меню причин, noShow инкремент.
- [ ] Старые SCHEDULED записи (до 30 дней) тоже получают post-session вопрос при первом деплое.
- [ ] noShowCount > 2 → бейдж «Ненадёжный» красным в списке клиентов и в карточке.
- [ ] При записи клиента с noShow > 0 — мастер получает предупреждение в уведомлении.
- [ ] LTV считается и отображается: в списке клиентов, в карточке клиента (с разбивкой по услугам), в профиле клиента.
- [ ] GET /appointments/my-stats возвращает траты клиента по мастерам и услугам.
- [ ] Поля favoriteDays / favoriteTimeBuckets в User entity, сохраняются через PATCH /profile.
- [ ] В профиле клиента — toggle-кнопки для выбора любимых дней и времени.
- [ ] В client-reminders при 21-дневном напоминании сначала используются ручные предпочтения, затем fallback на историю.
- [ ] Клиенты не видят прошедшие даты и прошедшие слоты при записи.
