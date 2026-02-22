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

## Чек-лист для проверки на форке

- [ ] Уведомление «Новая запись» мастеру в Telegram — клиент кликабельный (tg://user).
- [ ] Уведомление «Клиент отменил запись» — клиент кликабельный, причина в HTML экранирована.
- [ ] Новая запись из CRM — в уведомлении мастеру клиент ссылкой.
- [ ] В админке «Доступность» слоты идут от новых дат к старым; у клиентов порядок слотов не менялся.
- [ ] В «Доступность» слоты: красная полоска — прошедшая дата, зелёная — ближайшие 3 дня.
- [ ] Занятые слоты полупрозрачные и с подписью «Занят: Имя».
- [ ] GET /crm/clients принимает `search` и `sort`, возвращает firstVisitAt, фильтрация и сортировка работают.
- [ ] В «Клиенты» есть поле поиска (с debounce) и выпадающий список сортировки, запрос уходит с параметрами.
