import { ref, computed } from 'vue';
import { useTelegramWebApp } from './useTelegramWebApp';

const STORAGE_KEY = 'tg_auth';

export function useAuth() {
  const { initData, getApiUrl, isAvailable, user: tgUser } = useTelegramWebApp();

  const token = ref(localStorage.getItem(STORAGE_KEY) || '');
  const user = ref(JSON.parse(localStorage.getItem(`${STORAGE_KEY}_user`) || 'null'));
  const loading = ref(false);
  const error = ref(null);

  const isAuthenticated = computed(() => !!token.value);

  async function loginWithTelegram() {
    if (!initData.value) {
      error.value = 'Telegram initData not available. Open the app from Telegram.';
      return null;
    }

    loading.value = true;
    error.value = null;

    try {
      const res = await fetch(getApiUrl('/auth/telegram'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: initData.value }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      token.value = data.accessToken;
      user.value = data.user;
      localStorage.setItem(STORAGE_KEY, data.accessToken);
      localStorage.setItem(`${STORAGE_KEY}_user`, JSON.stringify(data.user));
      return data;
    } catch (err) {
      error.value = err.message;
      return null;
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}_user`);
  }

  function getAuthHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (token.value) h['Authorization'] = `Bearer ${token.value}`;
    return h;
  }

  async function ensureAuth() {
    if (token.value) return true;
    if (isAvailable.value && initData.value) {
      const result = await loginWithTelegram();
      return !!result;
    }
    return false;
  }

  /** Refresh user from backend (e.g. after isMaster changed in DB). */
  async function refreshUser() {
    if (!token.value) return;
    try {
      const res = await fetch(getApiUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${token.value}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      user.value = data;
      localStorage.setItem(`${STORAGE_KEY}_user`, JSON.stringify(data));
    } catch (_) {
      // ignore
    }
  }

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    tgUser,
    loginWithTelegram,
    logout,
    getAuthHeaders,
    getApiUrl,
    ensureAuth,
    refreshUser,
  };
}
