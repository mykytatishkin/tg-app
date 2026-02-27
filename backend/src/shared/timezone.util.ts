/**
 * Утилиты для работы с часовым поясом Вильнюса
 * В БД хранится локальное время по часовому поясу Вильнюса (Europe/Vilnius).
 * Эти утилиты обеспечивают правильное форматирование времени для уведомлений.
 */

const VILNIUS_TIMEZONE = 'Europe/Vilnius';

/**
 * Форматирует дату и время для отображения в уведомлениях.
 * Время в БД хранится в локальном времени Вильнюса, эта функция просто форматирует его.
 * @param date - дата в формате YYYY-MM-DD или объект Date
 * @param time - время в формате HH:MM или HH:MM:SS (локальное время Вильнюса)
 * @returns строка с датой и временем, например "2024-02-18 15:00"
 */
export function formatDateTimeForNotification(date: string | Date, time: string): string {
  const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  const timeStr = (time || '').slice(0, 5); // Обрезаем до HH:MM
  return `${dateStr} ${timeStr}`;
}

/**
 * Создает объект Date из даты и времени, интерпретируя их как локальное время Вильнюса.
 * Не зависит от часового пояса сервера (корректно работает при проде в Нидерландах и клиентах в Вильнюсе).
 * @param date - дата в формате YYYY-MM-DD или объект Date
 * @param time - время в формате HH:MM или HH:MM:SS (локальное время Вильнюса)
 * @returns объект Date (UTC момент)
 */
export function parseDateTimeInVilnius(date: string | Date, time: string): Date {
  const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  const timeStr = String(time ?? '').trim().slice(0, 8); // HH:MM or HH:MM:SS
  const [hour = 0, min = 0] = timeStr.split(':').map(Number);

  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);

  // Опорная точка: полдень UTC в этот день — по ней узнаём смещение Вильнюса (DST)
  const noonUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const noonDate = new Date(noonUtc);

  const vilniusFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: VILNIUS_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = vilniusFormatter.formatToParts(noonDate);
  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const vilniusHour = getPart('hour');
  const vilniusMin = getPart('minute');
  const vilniusSec = getPart('second');

  // Нужный момент в Вильнюсе (target) vs полдень в Вильнюсе: сдвиг в мс
  const targetLocalMs = (hour * 3600 + min * 60) * 1000;
  const noonVilniusMs = (vilniusHour * 3600 + vilniusMin * 60 + vilniusSec) * 1000;
  const deltaMs = targetLocalMs - noonVilniusMs;

  return new Date(noonUtc + deltaMs);
}

/**
 * Возвращает текущую дату в формате YYYY-MM-DD по часовому поясу Вильнюса
 */
export function getTodayInVilnius(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('lt-LT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: VILNIUS_TIMEZONE,
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  
  return `${year}-${month}-${day}`;
}

/**
 * Возвращает дату через N дней от сегодня в формате YYYY-MM-DD по часовому поясу Вильнюса
 * @param daysAhead - количество дней вперёд (может быть отрицательным для прошлых дат)
 */
export function getDateInVilnius(daysAhead: number): string {
  const now = new Date();
  now.setDate(now.getDate() + daysAhead);
  
  const formatter = new Intl.DateTimeFormat('lt-LT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: VILNIUS_TIMEZONE,
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  
  return `${year}-${month}-${day}`;
}
