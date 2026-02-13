# Деплой фронтенда через nginx (без ngrok)

Чтобы отдать Mini App в открытый доступ и использовать ссылку в Telegram вместо ngrok.

## Что нужно

- Сервер с белым IP или VPS с доменом
- Установленные nginx и (для HTTPS) certbot

## Шаги

### 1. Собрать фронтенд

```bash
cd frontend
npm ci
npm run build
```

Артефакты появятся в `frontend/dist/`.

### 2. Настроить nginx

- Скопируйте `deploy/nginx.conf` в `/etc/nginx/sites-available/tg-app` (или в `conf.d/`).
- Замените в конфиге:
  - `your-domain.com` — ваш домен (или `_` для доступа по IP).
  - `/path/to/tg-app` — полный путь к репозиторию на сервере (чтобы `root` указывал на `.../frontend/dist`).

Пример для доступа по IP без домена:

```nginx
server_name _;
root /home/user/tg-app/frontend/dist;
```

- Включите сайт и перезагрузите nginx:

```bash
sudo ln -s /etc/nginx/sites-available/tg-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Запустить бэкенд на том же сервере

Бэкенд должен слушать `localhost:3000` (или измените в nginx `proxy_pass` и порт в backend).

```bash
cd backend
npm ci
npm run build
# Запуск (лучше через systemd или pm2)
node dist/main.js
```

Убедитесь, что в `backend/.env` заданы переменные для прода (БД, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN` и т.д.).

### 4. Указать публичный URL в бэкенде и в боте

В `backend/.env`:

```env
# Публичный URL, по которому открывается фронт (без слэша в конце)
MINI_APP_URL=https://your-domain.com
```

Если используете IP без HTTPS:

```env
MINI_APP_URL=http://YOUR_SERVER_IP
```

**Важно:** Telegram Mini App лучше открывать по HTTPS. Для бесплатного SSL используйте certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

После этого в конфиге nginx добавьте блок `listen 443 ssl` (пример закомментирован в `deploy/nginx.conf`) или сгенерируйте конфиг через certbot.

### 5. Ссылка в Telegram

- В [@BotFather](https://t.me/BotFather) в настройках бота: **Bot Settings → Menu Button → Configure menu button** — укажите URL: `https://your-domain.com` (тот же, что в `MINI_APP_URL`).
- Либо бот уже использует `MINI_APP_URL` из кода для кнопки «Открыть приложение» — тогда достаточно прописать правильный `MINI_APP_URL` в `.env` и перезапустить бэкенд.

После этого фронт доступен по публичной ссылке, nginx раздаёт статику и проксирует `/api` на бэкенд, а в тг-апп передаётся эта ссылка через `MINI_APP_URL` (и кнопка в боте ведёт на неё).
