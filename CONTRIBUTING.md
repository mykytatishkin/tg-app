# Contribution Summary — 12 New Features

This document describes all changes made to the project in this fork, what works out of the box, what requires additional setup, and how to get everything running.

---

## What was done — 12 features (REQ-01 through REQ-12)

### REQ-01 — Master reviews in Mini App
- Clients can rate (1–5 stars) and comment on completed appointments from the **My Appointments** view.
- New `Review` entity with `masterId`, `clientId`, `appointmentId`, `rating`, `comment`, `createdAt`.
- Master profile page (`/master/:id`) shows average rating, star breakdown, and all text reviews.
- Endpoints: `POST /crm/reviews`, `GET /crm/masters/:id/reviews`.

### REQ-02 — Master portfolio (photo upload + gallery)
- Masters can upload and delete portfolio photos from the **Portfolio** admin section.
- Photos are stored in `backend/uploads/` (local disk via Multer).
- `PortfolioPhoto` entity tracks `masterId`, `filename`, `originalName`, `createdAt`.
- Gallery is visible on the public master profile with tag filtering.
- Endpoints: `POST /crm/portfolio`, `DELETE /crm/portfolio/:id`, `GET /appointments/masters/:id/portfolio`.

### REQ-03 — Calendar date picker
- Replaced the plain text date input with an interactive calendar component in the booking flow.
- Shows available/unavailable dates with visual highlight; confirms selection with a subtle animation.
- Date range limited to the next 60 days; past dates are not selectable.

### REQ-04 — City selection and persistence
- Clients can pick a city when booking; selection is persisted in `localStorage` and restored on next open.
- `city` column added to `User` entity.
- Masters are filtered by city when a city is selected; "all cities" option always available.
- Endpoint: `GET /appointments/cities`.

### REQ-05 — Telegram WebApp integration improvements
- Full-screen mode (`expand()`) called on mount in the booking and booking-success pages.
- `hapticFeedback` used on key interactions (save, cancel, confirm, navigation).
- `webApp.close()` called instead of routing away when closing from inside Telegram.
- `useTelegramWebApp` composable centralizes all WebApp calls.

### REQ-06 — "Found a bug?" button across the UI
- Persistent "Found a bug? 🐛" link in the client Profile view.
- Tapping it opens a pre-filled `t.me/...?start=bug_report` Telegram link so the user lands in the bot and can describe the issue.
- Also surfaced on the Dashboard for easy access.

### REQ-07 — Multi-language support (RU / UK / EN / LT)
- Integrated **vue-i18n** with four locale files: `src/i18n/ru.js`, `uk.js`, `en.js`, `lt.js`.
- Language preference saved to `localStorage` and applied on start-up.
- Language switcher in the client Profile view.
- All UI strings in Dashboard, Appointments, Book, BookingSuccess, Profile, MasterProfile, Review views are now i18n keys.
- Lithuanian (`lt`) translation included (starter quality — proofread before shipping to LT users).

### REQ-08 — Telegram Payments
- Masters can set a price on each service; a `totalPrice` field is stored on the appointment.
- New fields on `Appointment`: `invoiceId`, `paymentStatus` (PENDING / PAID / FAILED / REFUNDED), `totalPrice`, `paidAt`.
- `POST /appointments/:id/payment` creates an invoice via `telegram.createInvoiceLink()` and returns the invoice URL.
- The Mini App calls `WebApp.openInvoice(url, callback)` to open the native Telegram payment sheet.
- The bot handles `pre_checkout_query` (auto-approved) and `successful_payment` events to mark the appointment PAID.
- `POST /appointments/payment/confirm` (webhook-style, for testing without the bot event).
- **Requires `TELEGRAM_PAYMENT_PROVIDER_TOKEN`** — see setup notes below.

### REQ-09 — Service fee configuration and checkout transparency
- `SERVICE_FEE_PERCENT` env var (default `5`) controls the platform fee percentage.
- Fee is shown to the client at checkout (e.g. "Service fee: 5%").
- Fee is included in the Telegram invoice amount.
- Masters see their net amount in stats; admin sees the fee breakdown.

### REQ-10 — Master subscription model (Starter / Pro / Business)
- New `MasterSubscription` entity and `SubscriptionsModule`.
- **Tiers:**
  | Tier | Slots/month | Portfolio | Broadcast |
  |------|-------------|-----------|-----------|
  | Starter | 30 | ✗ | ✗ |
  | Pro | Unlimited | ✓ | ✓ |
  | Business | Unlimited | ✓ | ✓ |
- Every master auto-gets a Starter subscription on first access.
- Admin panel (`/admin/subscriptions`) lists all masters, lets admin change tier and extend months.
- Admin can suspend / reactivate a master's subscription.
- `@Cron` job runs at midnight and auto-expires subscriptions past their `validUntil` date.
- `MasterSettings.vue` shows the master's current subscription status and a warning if inactive.
- Endpoints: `GET /subscriptions/mine`, `GET /subscriptions` (admin), `POST /subscriptions/:masterId`, `POST /subscriptions/:masterId/status`.

### REQ-11 — Master bio field
- `bio` text column (max 500 chars) added to the `User` entity.
- Masters edit their bio in **Profile Settings** (`/admin/settings`).
- Bio is displayed (collapsible with "read more") on the public master profile page.
- Endpoint: `PATCH /crm/masters/profile` accepts `{ bio }`.

### REQ-12 — Personalized slot recommendations algorithm
- `GET /appointments/recommendations` returns up to 8 scored slot recommendations.
- **Scoring** (per slot):
  - +3 — service matches client's most-booked service
  - +2 — weekday matches client's preferred days
  - +1 — time-of-day bucket (morning / afternoon / evening) matches client's preferred times
  - Profile preference boost added on top
- **Cold start** (new clients with no history): ranked by global service popularity + profile prefs.
- Only masters with avg rating ≥ 3.5 and an active subscription appear in recommendations.
- `RecommendedSlots.vue` component renders a horizontal scroll strip above the booking form; clicking a card pre-fills the booking form.

---

## What is NOT done / needs extra setup

### Payments — `TELEGRAM_PAYMENT_PROVIDER_TOKEN`
The payment flow requires a real payment provider token from BotFather:

1. Open [@BotFather](https://t.me/BotFather) → `/mybots` → select your bot → **Payments**.
2. Connect a payment provider (e.g. **Stripe**). For development use **Stripe TEST** mode — BotFather gives a test token that charges fake cards.
3. Set `TELEGRAM_PAYMENT_PROVIDER_TOKEN=<token>` in `backend/.env`.

Without this token, `POST /appointments/:id/payment` returns `invoiceUrl: null` and the frontend skips the payment step silently.

### Subscription enforcement in booking
`SubscriptionsService.canBook(masterId)` exists and is tested, but **is not yet wired as a guard on the booking endpoint**. Currently a master with an expired subscription can still receive new bookings. To enforce it:
- Inject `SubscriptionsService` into `CrmService` or `AppointmentsService`.
- Call `canBook()` inside `book()` and throw `ForbiddenException` if it returns `false`.

### Portfolio — local disk storage
Photos are saved to `backend/uploads/` on the server filesystem. This is fine for development but unsuitable for production behind a load balancer or on ephemeral containers. For production:
- Replace the Multer `DiskStorage` in `CrmModule` with an S3/GCS/Cloudflare R2 upload.
- Update `GET /crm/portfolio/file/:filename` to redirect to the CDN URL.

### Lithuanian translation
The LT locale file (`frontend/src/i18n/lt.js`) is a starter translation. Have it reviewed by a native Lithuanian speaker before enabling LT as a default for real users.

### Debug artifacts (should be removed before production)
- `AppointmentsBook.vue` — there may be leftover `console.log` / `fetch('http://127.0.0.1:7243/...')` calls from development. Search and remove before deploying.
- `database.config.ts` — verify that `synchronize: true` is only enabled when `NODE_ENV !== 'production'` (it already has this check, but double-check).

### Redis usage
Redis is in `docker-compose.yml` but the only current consumer is the session/cache layer. If you add rate-limiting or job queues, document the Redis keys/prefixes in a `docs/REDIS.md`.

---

## Setup guide

### Prerequisites
- **Node.js** ≥ 18
- **Docker + Docker Compose** (for PostgreSQL and Redis)
- A **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)
- A public HTTPS URL for the Mini App (use [ngrok](https://ngrok.com) for local dev)

### 1. Clone and configure

```bash
git clone <your-fork-url>
cd tg-app
cp backend/.env.example backend/.env
```

Edit `backend/.env` — the required variables:

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | From BotFather |
| `MINI_APP_URL` | Public HTTPS URL of the frontend (ngrok/your domain) |
| `JWT_SECRET` | Any random 32+ char string |
| `TELEGRAM_PAYMENT_PROVIDER_TOKEN` | From BotFather → Payments (optional — payments disabled if missing) |
| `SERVICE_FEE_PERCENT` | Platform fee %, default `5` |
| `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | PostgreSQL connection (default values work with docker-compose) |
| `STAGE` | `local` shows "in test" badge; any other value = production mode |

### 2. Start the database

```bash
docker-compose up -d
```

This starts PostgreSQL on port 5432 and Redis on port 6379.

### 3. Backend

```bash
cd backend
npm install
npm run start:dev
```

The API runs on `http://localhost:3000`.  
TypeORM is configured with `synchronize: true` in non-production mode, so the schema is created automatically on first start.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` (or whichever port Vite picks).

### 5. Connect the bot to the Mini App

In [@BotFather](https://t.me/BotFather):
1. `/setmenubutton` → select your bot → set URL to your `MINI_APP_URL`.
2. For local dev, use `ngrok http 5173` and set that URL.

### 6. First-time role setup

On first login (any Telegram user), the app creates a `client` role.  
To make yourself an admin, directly update the DB:

```sql
UPDATE users SET role = 'admin' WHERE telegram_id = <your_telegram_id>;
```

Or promote via the API if you already have an admin account.

---

## Project structure (quick reference)

```
tg-app/
├── backend/
│   ├── src/
│   │   ├── appointments/   # Booking, slots, recommendations, payments
│   │   ├── auth/           # JWT auth, Telegram WebApp init data validation
│   │   ├── bot/            # Telegraf bot, reminders cron, payment webhooks
│   │   ├── crm/            # Masters, clients, services, portfolio, reviews
│   │   ├── subscriptions/  # Subscription tiers, admin control, auto-expire cron
│   │   └── app.module.ts
│   ├── uploads/            # Portfolio photos (local disk)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios client with JWT interceptor
│   │   ├── composables/    # useTelegramWebApp, useCity, etc.
│   │   ├── i18n/           # ru.js, uk.js, en.js, lt.js
│   │   ├── router/         # Vue Router routes
│   │   └── views/
│   │       ├── admin/      # Master/admin-only pages
│   │       └── ...         # Client-facing pages
└── docker-compose.yml
```

---

## Summary table

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| REQ-01 | Master reviews | ✅ Done | |
| REQ-02 | Portfolio photos | ✅ Done | Local disk only — swap to S3 for prod |
| REQ-03 | Calendar date picker | ✅ Done | |
| REQ-04 | City selection | ✅ Done | |
| REQ-05 | WebApp integration | ✅ Done | |
| REQ-06 | Bug report button | ✅ Done | |
| REQ-07 | Multi-language (RU/UK/EN/LT) | ✅ Done | LT needs native review |
| REQ-08 | Telegram Payments | ✅ Done | Needs `TELEGRAM_PAYMENT_PROVIDER_TOKEN` |
| REQ-09 | Service fee | ✅ Done | |
| REQ-10 | Subscription model | ✅ Done | Enforcement guard not wired into booking yet |
| REQ-11 | Master bio | ✅ Done | |
| REQ-12 | Slot recommendations | ✅ Done | |
