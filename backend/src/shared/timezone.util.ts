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
 * Используется для расчетов (например, сколько минут до записи).
 * @param date - дата в формате YYYY-MM-DD или объект Date
 * @param time - время в формате HH:MM или HH:MM:SS (локальное время Вильнюса)
 * @returns объект Date
 */
export function parseDateTimeInVilnius(date: string | Date, time: string): Date {
  const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  const timeStr = String(time ?? '').trim();
  const timeNormalized = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  
  // Парсим как локальное время (без 'Z' на конце)
  // Это будет интерпретировано в часовом поясе сервера
  return new Date(`${dateStr}T${timeNormalized}`);
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
