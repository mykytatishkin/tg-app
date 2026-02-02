---
name: Post-session feedback flow
overview: "После закрытия записи мастером (статус DONE) клиент получает от бота запрос оценить сеанс: рейтинг 1–5 звёзд, комментарий и выбор «что понравилось» из настраиваемых вариантов мастера. Отзыв сохраняется в БД, привязывается к записи и к мастеру; статистика мастера и карточка приёма показывают эти данные."
todos: []
isProject: false
---

# Оповещение клиента и сбор отзывов после закрытия приёма

## Текущее состояние

- Закрытие приёма: мастер в [AppointmentDetail.vue](frontend/src/views/admin/AppointmentDetail.vue) нажимает «Завершено» → `PUT /crm/appointments/:id` с `{ status: 'done' }`. В [CrmService.updateAppointment](backend/src/crm/crm.service.ts) обрабатывается только переход в `CANCELLED` (уведомление клиенту); при переходе в `DONE` уведомление не отправляется.
- Бот: [BotService](backend/src/bot/bot.service.ts) умеет отправлять сообщения по `chatId`, есть инлайн-кнопки (напитки, быстрый тест) и in-memory состояние по шагам ([quick-test.state.ts](backend/src/bot/quick-test.state.ts)).
- Сущности: [Appointment](backend/src/crm/entities/appointment.entity.ts) не содержит полей отзыва; [User](backend/src/auth/entities/user.entity.ts) имеет `drinkOptions` (варианты напитков), аналога для вариантов «что понравилось» нет.

## Архитектура решения

```mermaid
sequenceDiagram
  participant Admin as Admin UI
  participant API as CRM API
  participant Bot as BotService
  participant Client as Client TG
  participant DB as DB

  Admin->>API: PUT appointment status=done
  API->>DB: update appointment
  API->>Bot: sendFeedbackRequest(chatId, appointmentId, options)
  Bot->>Client: "Оцените сеанс 1-5 звёзд" + кнопки
  Client->>Bot: нажатие звёзд / текст / "что понравилось"
  Bot->>DB: save AppointmentFeedback
  Bot->>Client: "Спасибо за отзыв"
  Optional: Bot->>Master: уведомление о новом отзыве
```



- **Хранение отзыва**: отдельная сущность `AppointmentFeedback` (one-to-one с Appointment): рейтинг 1–5, комментарий (nullable), выбранные пункты «что понравилось» (JSON массив строк). По каждому приёму отзыв можно смотреть в карточке записи; по мастеру — агрегаты в статистике.
- **Варианты «что понравилось»**: настраиваемый список мастера, по аналогии с `drinkOptions` — поле `feedbackOptions: string[] | null` в [User](backend/src/auth/entities/user.entity.ts). Админка настройки этих опций — отдельная задача или позже; в первом релизе можно задать общий дефолтный список в коде (или пустой массив, тогда шаг «что понравилось» пропускать).
- **Триггер**: при `updateAppointment` с `dto.status === AppointmentStatus.DONE` и наличием `previous.client.telegramId` вызывать новый метод бота «отправить запрос отзыва» (см. ниже).
- **Сценарий в боте**: многошаговый диалог (как quick-test): состояние в памяти по ключу `chatId` (или `chatId_appointmentId`), шаги: (1) звёзды 1–5, (2) комментарий (текст или кнопка «Пропустить»), (3) «Что понравилось?» — мультивыбор из `feedbackOptions` мастера + кнопка «Готово», затем сохранение в БД и ответ «Спасибо».

## План реализации

### 1. Backend: модель и API отзыва

- **Сущность** [backend/src/crm/entities/appointment-feedback.entity.ts](backend/src/crm/entities/appointment-feedback.entity.ts) (новый файл):
  - `id` (PK), `appointmentId` (FK → appointments, unique — один отзыв на приём), `rating` (1–5), `comment` (text, nullable), `whatWasGood` (json, string[] — выбранные варианты).
  - Relation: `Appointment` has one optional `feedback` (OneToOne).
- В [appointment.entity.ts](backend/src/crm/entities/appointment.entity.ts): добавить связь `feedback?: AppointmentFeedback` и при необходимости поле `feedbackRequestedAt?: Date` (когда бот отправил запрос отзыва), чтобы не слать повторно.
- **Регистрация**: сущность в `TypeOrmModule` в [CrmModule](backend/src/crm/crm.module.ts). Никаких отдельных миграций не требуется (используется `synchronize` в dev).

### 2. Backend: опции «что понравилось» у мастера

- В [User](backend/src/auth/entities/user.entity.ts): поле `feedbackOptions: string[] | null` (как `drinkOptions`).
- В дальнейшем — экран настроек в админке и API обновления профиля мастера; для MVP можно не делать UI и использовать дефолтный список в коде бота, если `feedbackOptions` пустой.

### 3. Backend: отправка запроса отзыва при закрытии приёма

- В [CrmService.updateAppointment](backend/src/crm/crm.service.ts): при `dto.status === AppointmentStatus.DONE` и `previous?.client?.telegramId` загрузить запись с `relations: ['client', 'service', 'master']`, проверить, что у приёма ещё нет отзыва (и при необходимости что не слали запрос ранее), затем вызвать `botService.sendFeedbackRequest(clientTelegramId, appointmentId, master.feedbackOptions ?? DEFAULT_FEEDBACK_OPTIONS)`.
- В [BotService](backend/src/bot/bot.service.ts): новый метод `sendFeedbackRequest(chatId, appointmentId, options: string[])` — отправить сообщение «Оцените сеанс от 1 до 5 звёзд» и инлайн-кнопки [1][2][3][4][5] с callback `feedback_stars_<appointmentId>_<1-5>`.
- Зависимость: CrmModule уже импортирует BotModule; BotService остаётся в BotModule и вызывается из CrmService — циклической зависимости нет.

### 4. Backend: сценарий сбора отзыва в боте

- **Состояние**: новый in-memory Map (по аналогии с `quickTestSessions`), ключ — `chatId` или `chatId_appointmentId`, значение — `{ appointmentId, step: 'stars'|'comment'|'whatGood'|'done', rating?, comment?, selectedGood?: number[] }`.
- **Обработчики**:
  - `action('feedback_stars_*')`: сохранить рейтинг, перейти к шагу «комментарий» — отправить «Напишите комментарий» + кнопку «Пропустить».
  - Текстовое сообщение в контексте шага `comment`: сохранить как комментарий, перейти к «что понравилось» (если есть варианты) или сразу сохранить отзыв в БД.
  - `action('feedback_skip_comment_*')`: пропуск комментария, переход к «что понравилось» или сохранение.
  - `action('feedback_good_*')`: мультивыбор — добавлять/убирать индекс в `selectedGood`, обновлять кнопки (галочки) или просто собирать; кнопка «Готово» — сохранить отзыв в БД, очистить состояние, ответить «Спасибо за отзыв».
- **Сохранение**: в BotModule инжектить `Repository<AppointmentFeedback>` и при необходимости `Repository<Appointment>` (с relation master). После завершения шагов вызвать `feedbackRepo.insert()` или `save()` (проверка по `appointmentId`: один отзыв на приём). Опционально: отправить мастеру сообщение «Клиент X оставил отзыв: N звёзд, …».

### 5. Backend: чтение отзыва в API

- [getAppointment](backend/src/crm/crm.service.ts): в запросе добавить `relations: ['client', 'service', 'feedback']`, чтобы в ответе возвращался объект `feedback` (если есть).
- [getStats](backend/src/crm/crm.service.ts): расширить ответ: средний рейтинг по мастеру, количество отзывов (и при желании распределение по звёздам). Данные брать из join с `AppointmentFeedback` по записям мастера.

### 6. Frontend: отзыв в карточке приёма и в статистике

- [AppointmentDetail.vue](frontend/src/views/admin/AppointmentDetail.vue): для `appointment.status === 'done'` вывести блок «Отзыв»: рейтинг (звёзды), комментарий, список «что понравилось» — если есть `appointment.feedback`.
- [Stats.vue](frontend/src/views/admin/Stats.vue): вывести средний рейтинг и количество отзывов из `stats.averageRating` / `stats.feedbackCount` (или аналогичных полей из обновлённого `getStats`).

## Важные детали

- **Один отзыв на приём**: при сохранении проверять отсутствие записи по `appointmentId`; при повторном нажатии в боте можно ответить «Вы уже оставили отзыв».
- **Таймаут состояния**: при долгом неответе клиента in-memory состояние можно не хранить бесконечно (например, TTL 24 часа или до следующего /start).
- **Права**: сохранение отзыва в боте только по callback/text от пользователя с `chatId === client.telegramId`; проверка через загрузку Appointment по `appointmentId` и сравнение `client.telegramId`.
- **Дефолтные варианты «что понравилось»**: если у мастера не заданы `feedbackOptions`, использовать захардкоженный список (например: «Качество работы», «Общение», «Атмосфера», «Скорость») или не показывать шаг мультивыбора — на усмотрение реализации.

## Файлы для изменения/создания


| Действие | Файл                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Создать  | `backend/src/crm/entities/appointment-feedback.entity.ts`                                                                 |
| Изменить | `backend/src/crm/entities/appointment.entity.ts` (relation, опционально feedbackRequestedAt)                              |
| Изменить | `backend/src/auth/entities/user.entity.ts` (feedbackOptions)                                                              |
| Изменить | `backend/src/crm/crm.service.ts` (updateAppointment → вызов бота при DONE; getAppointment + feedback; getStats + рейтинг) |
| Изменить | `backend/src/crm/crm.module.ts` (TypeOrm forFeature AppointmentFeedback)                                                  |
| Изменить | `backend/src/bot/bot.service.ts` (sendFeedbackRequest, обработчики feedback_*, состояние, сохранение в БД)                |
| Изменить | `backend/src/bot/bot.module.ts` (TypeOrm forFeature AppointmentFeedback, если репозиторий инжектится в BotService)        |
| Изменить | `frontend/src/views/admin/AppointmentDetail.vue` (блок отзыва)                                                            |
| Изменить | `frontend/src/views/admin/Stats.vue` (средний рейтинг, количество отзывов)                                                |


При необходимости позже: настройка `feedbackOptions` в профиле мастера (админка + API пользователя).