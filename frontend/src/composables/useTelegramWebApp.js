import { computed, onMounted } from 'vue';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function useTelegramWebApp() {
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

  const isAvailable = computed(() => !!webApp);

  const initData = computed(() => webApp?.initData || '');

  const user = computed(() => webApp?.initDataUnsafe?.user || null);

  const themeParams = computed(() => webApp?.themeParams || {});

  const colorScheme = computed(() => webApp?.colorScheme || 'light');

  function expand() {
    webApp?.expand();
  }

  function ready() {
    webApp?.ready();
  }

  function close() {
    webApp?.close();
  }

  function showAlert(message) {
    webApp?.showAlert?.(message);
  }

  function showConfirm(message) {
    return new Promise((resolve) => {
      webApp?.showConfirm?.(message, resolve);
    });
  }

  function hapticFeedback(type = 'light') {
    webApp?.HapticFeedback?.impactOccurred?.(type);
  }

  function getApiUrl(path) {
    const base = API_BASE.startsWith('http') ? API_BASE : `${window.location.origin}${API_BASE}`;
    return `${base}${path}`;
  }

  onMounted(() => {
    if (webApp) {
      webApp.ready();
      webApp.expand();
    }
  });

  return {
    webApp,
    isAvailable,
    initData,
    user,
    themeParams,
    colorScheme,
    expand,
    ready,
    close,
    showAlert,
    showConfirm,
    hapticFeedback,
    getApiUrl,
  };
}
