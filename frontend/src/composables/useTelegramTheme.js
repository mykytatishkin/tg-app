import { onMounted, onUnmounted } from 'vue';

const THEME_MAP = {
  bg_color: '--tg-theme-bg-color',
  text_color: '--tg-theme-text-color',
  hint_color: '--tg-theme-hint-color',
  link_color: '--tg-theme-link-color',
  button_color: '--tg-theme-button-color',
  button_text_color: '--tg-theme-button-text-color',
  secondary_bg_color: '--tg-theme-secondary-bg-color',
  header_bg_color: '--tg-theme-header-bg-color',
  bottom_bar_bg_color: '--tg-theme-bottom-bar-bg-color',
  accent_text_color: '--tg-theme-accent-text-color',
  section_bg_color: '--tg-theme-section-bg-color',
  section_header_text_color: '--tg-theme-section-header-text-color',
  section_separator_color: '--tg-theme-section-separator-color',
  subtitle_text_color: '--tg-theme-subtitle-text-color',
  destructive_text_color: '--tg-theme-destructive-text-color',
};

const FALLBACK_LIGHT = {
  '--tg-theme-bg-color': '#ffffff',
  '--tg-theme-text-color': '#000000',
  '--tg-theme-hint-color': '#999999',
  '--tg-theme-link-color': '#2481cc',
  '--tg-theme-button-color': '#2481cc',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#f4f4f5',
};

const FALLBACK_DARK = {
  '--tg-theme-bg-color': '#18222d',
  '--tg-theme-text-color': '#ffffff',
  '--tg-theme-hint-color': '#8e8e93',
  '--tg-theme-link-color': '#62bcf9',
  '--tg-theme-button-color': '#62bcf9',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-secondary-bg-color': '#232e3c',
};

function applyThemeParams(params, root = document.documentElement) {
  if (!params || typeof params !== 'object') return;
  Object.entries(THEME_MAP).forEach(([key, cssVar]) => {
    if (params[key]) {
      root.style.setProperty(cssVar, params[key]);
    }
  });
}

function applyFallback(root = document.documentElement) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const fallback = prefersDark ? FALLBACK_DARK : FALLBACK_LIGHT;
  Object.entries(fallback).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function useTelegramTheme() {
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
  let themeHandler = null;

  function apply() {
    const root = document.documentElement;
    if (webApp?.themeParams && Object.keys(webApp.themeParams).length > 0) {
      applyThemeParams(webApp.themeParams, root);
    } else {
      applyFallback(root);
    }
  }

  onMounted(() => {
    apply();
    if (webApp?.onEvent) {
      themeHandler = () => apply();
      webApp.onEvent('themeChanged', themeHandler);
    }
  });

  onUnmounted(() => {
    if (webApp?.offEvent && themeHandler) {
      webApp.offEvent('themeChanged', themeHandler);
    }
  });

  return { apply };
}
