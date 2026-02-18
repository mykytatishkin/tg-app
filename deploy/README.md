# Деплой фронтенда через nginx (без ngrok)

Чтобы отдать Mini App в открытый доступ и использовать ссылку в Telegram вместо ngrok.

## Что нужно

- Сервер с белым (внешним) IP или VPS
- nginx; для HTTPS с доменом — certbot

## Шаги

### 1. Запустить фронтенд в dev-режиме

На сервере держите запущенным Vite:

```bash
cd frontend
npm ci
npm run dev
```

Фронт крутится на порту 5173; nginx проксирует на него запросы (сборка `dist` не нужна).

### 2. Настроить nginx

- Скопируйте `deploy/nginx.conf` в `/etc/nginx/sites-available/tg-app` (или в `conf.d/`).
- **Только IP:** в конфиге уже стоит `server_name _;` — ничего не меняйте, nginx будет принимать запросы по IP.
- **С доменом:** замените `_` на ваш домен, например `server_name myapp.com;`.

Включите сайт и перезагрузите nginx:

```bash
sudo ln -s /etc/nginx/sites-available/tg-app /etc/nginx/fastpanel2-available/
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

В `backend/.env` укажите тот URL, по которому пользователи открывают фронт (без слэша в конце):

**Важно:** для кнопок Web App и меню Telegram принимает **только HTTPS**. `http://IP` выдаст ошибку «Only HTTPS links are allowed».

**Вариант A — HTTPS без своего домена (nip.io)**  
Сервис [nip.io](https://nip.io) даёт «домен», который резолвится в ваш IP: `46.21.250.43.nip.io` → `46.21.250.43`. На сервере:

1. В nginx укажите `server_name 46.21.250.43.nip.io;` (подставьте свой IP).
2. Получите сертификат:  
   `sudo certbot --nginx -d 46.21.250.43.nip.io`  
   (certbot сам добавит `listen 443 ssl` в конфиг.)
3. В `.env`:  
   `MINI_APP_URL=https://46.21.250.43.nip.io`

**Вариант B — свой домен и HTTPS:**  
Настройте A-запись домена на IP сервера, затем:
```env
MINI_APP_URL=https://your-domain.com
```
Получите сертификат: `sudo certbot --nginx -d your-domain.com`

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d 46.21.250.43.nip.io   # или your-domain.com
```

Certbot сам добавит SSL в конфиг nginx. Перезапустите бэкенд после смены `MINI_APP_URL`.

### 5. Ссылка в Telegram

Кнопка «Открыть приложение» и Web App-кнопки в боте берут URL из `MINI_APP_URL` — задайте в `.env` **только HTTPS**-адрес (например `https://46.21.250.43.nip.io`) и перезапустите бэкенд. В BotFather ничего менять не нужно.

После этого фронт доступен по публичной ссылке, nginx раздаёт статику и проксирует `/api` на бэкенд, а в тг-апп передаётся эта ссылка через `MINI_APP_URL` (и кнопка в боте ведёт на неё).
