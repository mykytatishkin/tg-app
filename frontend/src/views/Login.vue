<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuth } from '../composables/useAuth';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { t } = useI18n();
const { loginWithTelegram, isAuthenticated, loading, error } = useAuth();
const { isAvailable } = useTelegramWebApp();

async function handleLogin() {
  error.value = null;
  const result = await loginWithTelegram();
  if (result) router.replace('/');
}

onMounted(async () => {
  error.value = null;
  if (isAuthenticated.value) {
    router.replace('/');
    return;
  }
  if (isAvailable.value) {
    await handleLogin();
  }
});
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color,#000)]">
    <h1 class="text-2xl font-bold mb-4">{{ t('login.title') }}</h1>

    <div v-if="!isAvailable" class="text-center max-w-sm space-y-6">
      <div class="text-6xl mb-2">💅</div>
      <h2 class="text-xl font-semibold">{{ t('login.title') }}</h2>
      <p class="text-[var(--tg-theme-hint-color,#999)] text-sm leading-relaxed">
        {{ t('login.subtitle') }}
      </p>
      <div class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-sm text-[var(--tg-theme-hint-color,#999)]">
        {{ t('login.openFromTelegram') }}
      </div>
    </div>

    <div v-else class="w-full max-w-sm space-y-4">
      <button
        v-if="!loading && !isAuthenticated"
        class="w-full py-3 px-4 rounded-lg font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
        @click="handleLogin"
      >
        {{ t('login.signIn') }}
      </button>
      <div v-else-if="loading" class="text-center py-4">
        <p>{{ t('login.signingIn') }}</p>
      </div>
      <p v-if="error" class="text-neutral-400 text-sm">{{ error }}</p>
    </div>
  </div>
</template>
