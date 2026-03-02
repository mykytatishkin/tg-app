/**
 * Google Maps URL и HTML-ссылка для адреса в уведомлениях.
 */

const GOOGLE_MAPS_SEARCH = 'https://www.google.com/maps/search/?api=1&query=';

/** URL для поиска адреса в Google Maps */
export function getGoogleMapsUrl(address: string): string {
  const trimmed = (address || '').trim();
  if (!trimmed) return '';
  return GOOGLE_MAPS_SEARCH + encodeURIComponent(trimmed);
}

/** HTML-ссылка для Telegram (parse_mode: HTML): кликабельный адрес */
export function getClickableAddressHtml(address: string): string {
  const trimmed = (address || '').trim();
  if (!trimmed) return '';
  const url = getGoogleMapsUrl(trimmed);
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return ` <a href="${url}">${escaped}</a>`;
}
