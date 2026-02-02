import { onMounted, onUnmounted } from 'vue';

/* Чёрно-белая полуготическая тема — переопределяем тему Telegram (в т.ч. после её применения) */
const B_W_THEME = {
  '--tg-theme-bg-color': '#0d0d0d',
  '--tg-theme-text-color': '#e8e8e8',
  '--tg-theme-hint-color': '#b8b8b8',
  '--tg-theme-link-color': '#c0c0c0',
  '--tg-theme-button-color': '#1a1a1a',
  '--tg-theme-button-text-color': '#e8e8e8',
  '--tg-theme-secondary-bg-color': '#1a1a1a',
  '--tg-theme-section-bg-color': '#2a2a2a',
  '--tg-theme-section-separator-color': '#3a3a3a',
  '--tg-theme-accent-text-color': '#fff',
  '--tg-theme-header-bg-color': '#0d0d0d',
  '--tg-theme-section-header-text-color': '#e8e8e8',
  '--tg-theme-subtitle-text-color': '#b8b8b8',
  '--tg-theme-destructive-text-color': '#c0c0c0',
};

function applyBwTheme(root = document.documentElement) {
  Object.entries(B_W_THEME).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function useTelegramTheme() {
  const timeoutIds = [];

  function apply() {
    if (typeof document !== 'undefined') applyBwTheme();
  }

  onMounted(() => {
    apply();
    [50, 200, 500, 1500].forEach((ms) => timeoutIds.push(setTimeout(apply, ms)));
    const webApp = window.Telegram?.WebApp;
    if (webApp?.onEvent) webApp.onEvent('themeChanged', apply);
  });

  onUnmounted(() => {
    timeoutIds.forEach((id) => clearTimeout(id));
    const webApp = window.Telegram?.WebApp;
    if (webApp?.offEvent) webApp.offEvent('themeChanged', apply);
  });

  return { apply };
}
