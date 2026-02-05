#!/usr/bin/env node
/**
 * Скрипт для получения OneDrive refresh_token через OAuth2.
 * Запустить: node get-onedrive-token.js
 * После авторизации в браузере скопировать refresh_token из консоли.
 */

require('dotenv').config({ path: require('path').join(__dirname, 'backend', '.env') });
const http = require('http');
const { spawn } = require('child_process');

const CLIENT_ID = process.env.ONEDRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.ONEDRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3456/callback';
const SCOPES = ['Files.ReadWrite.All', 'offline_access'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Ошибка: ONEDRIVE_CLIENT_ID и ONEDRIVE_CLIENT_SECRET должны быть в backend/.env');
  process.exit(1);
}

// Используем формат scope для Microsoft Identity Platform v2.0
const scopeParam = SCOPES.map(s => `https://graph.microsoft.com/${s}`).join(' ');
const authUrl = `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopeParam)}&response_mode=query`;

console.log('🔐 Получение OneDrive refresh_token\n');
console.log('🔍 Debug: CLIENT_ID =', CLIENT_ID);
console.log('🔍 Debug: Auth URL =', authUrl, '\n');
console.log('1. Сейчас откроется браузер для авторизации');
console.log('2. Войдите под своим Microsoft-аккаунтом');
console.log('3. Разрешите доступ к OneDrive');
console.log('4. После редиректа refresh_token появится в консоли\n');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname !== '/callback') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    console.error('❌ Ошибка авторизации:', error);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>Ошибка: ${error}</h1><p>Закройте это окно и попробуйте снова.</p>`);
    server.close();
    return;
  }

  if (!code) {
    res.writeHead(400);
    res.end('No authorization code received');
    server.close();
    return;
  }

  console.log('✅ Код авторизации получен, обмениваем на токены...\n');

  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await tokenRes.json();

    if (!tokenRes.ok || !data.refresh_token) {
      console.error('❌ Не удалось получить refresh_token:', data);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>Ошибка</h1><pre>${JSON.stringify(data, null, 2)}</pre>`);
      server.close();
      return;
    }

    console.log('✅ Токены получены!\n');
    console.log('📋 Скопируйте и добавьте в .env:\n');
    console.log(`ONEDRIVE_REFRESH_TOKEN=${data.refresh_token}\n`);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <h1 style="color: green;">✅ Успешно!</h1>
      <p>Скопируйте refresh_token из консоли и добавьте в <code>.env</code></p>
      <p>Можно закрыть это окно.</p>
      <details>
        <summary>Показать токен здесь</summary>
        <pre style="background: #f5f5f5; padding: 10px; overflow-wrap: break-word;">${data.refresh_token}</pre>
      </details>
    `);

    setTimeout(() => server.close(), 1000);
  } catch (err) {
    console.error('❌ Ошибка при получении токена:', err.message);
    res.writeHead(500);
    res.end('Internal server error');
    server.close();
  }
});

server.listen(3456, () => {
  console.log('🌐 Локальный сервер запущен на http://localhost:3456');
  console.log('🚀 Открываю браузер...\n');
  
  // Открываем браузер (работает на macOS/Linux/Windows)
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(cmd, [authUrl], { shell: true, detached: true, stdio: 'ignore' }).unref();
});

server.on('close', () => {
  console.log('\n👋 Сервер остановлен. Готово!');
  process.exit(0);
});
