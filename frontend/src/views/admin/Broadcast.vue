<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';
import { api } from '../../api/client';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const message = ref('');
const loading = ref(false);
const result = ref(null);
const error = ref(null);

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

async function sendBroadcast() {
  const trimmed = message.value?.trim() || '';
  if (!trimmed) {
    error.value = 'Введите сообщение';
    return;
  }
  const confirmed = window.confirm(
    'Сообщение будет отправлено всем пользователям в Telegram. Продолжить?',
  );
  if (!confirmed) return;

  loading.value = true;
  result.value = null;
  error.value = null;
  try {
    const data = await api.post('/auth/broadcast', { message: trimmed });
    result.value = data;
  } catch (e) {
    error.value = e.message || 'Ошибка отправки';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)]">
    <div class="flex items-center gap-2 mb-6">
      <button
        type="button"
        class="p-1 rounded-lg text-[var(--tg-theme-hint-color,#999)]"
        aria-label="Назад"
        @click="goBack"
      >
        ←
      </button>
      <h1 class="text-xl font-bold">Рассылка</h1>
    </div>

    <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-4">
      Сообщение будет отправлено всем пользователям в Telegram. Можно использовать HTML (например, &lt;b&gt;жирный&lt;/b&gt;). Макс. 4000 символов.
    </p>

    <textarea
      v-model="message"
      class="w-full min-h-[120px] p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] border border-[var(--tg-theme-hint-color,#999)]/20 resize-y mb-4"
      placeholder="Введите сообщение..."
      maxlength="4000"
      :disabled="loading"
    />

    <button
      type="button"
      class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] disabled:opacity-50"
      :disabled="loading || !message?.trim()"
      @click="sendBroadcast"
    >
      {{ loading ? 'Отправка…' : 'Отправить всем' }}
    </button>

    <p v-if="result" class="mt-4 text-sm text-[var(--tg-theme-hint-color,#999)]">
      Доставлено: {{ result.sent }}, не доставлено: {{ result.failed }}, всего получателей: {{ result.total }}.
    </p>
    <p v-if="error" class="mt-2 text-sm text-red-600 dark:text-red-400">
      {{ error }}
    </p>
  </div>
</template>
