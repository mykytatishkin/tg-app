<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { loginWithTelegram, isAuthenticated, loading, error } = useAuth();
const { isAvailable } = useTelegramWebApp();

async function handleLogin() {
  const result = await loginWithTelegram();
  if (result) router.replace('/');
}

onMounted(async () => {
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
  <div class="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--tg-theme-bg-color,#fff)] text-[var(--tg-theme-text-color,#000)]">
    <h1 class="text-2xl font-bold mb-4">Nail Master CRM</h1>

    <div v-if="!isAvailable" class="text-center text-gray-500">
      <p>Open this app from Telegram to sign in.</p>
    </div>

    <div v-else class="w-full max-w-sm space-y-4">
      <button
        v-if="!loading && !isAuthenticated"
        class="w-full py-3 px-4 rounded-lg font-medium bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)]"
        @click="handleLogin"
      >
        Sign in with Telegram
      </button>
      <div v-else-if="loading" class="text-center py-4">
        <p>Signing in...</p>
      </div>
      <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
    </div>
  </div>
</template>
