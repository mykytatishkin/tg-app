<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';
import { api } from '../api/client';

const CATEGORIES = [
  'UI/UX',
  'Функционал',
  'Ошибки и баги',
  'Навигация',
  'Контент',
  'Другое',
];

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const text = ref('');
const category = ref('');
const loading = ref(false);
const error = ref(null);
const success = ref(false);

function goBack() {
  hapticFeedback?.('light');
  router.push('/profile');
}

async function submit() {
  const trimmed = text.value?.trim() || '';
  if (!trimmed) {
    error.value = 'Введите текст предложения';
    return;
  }
  if (!category.value) {
    error.value = 'Выберите категорию';
    return;
  }
  loading.value = true;
  error.value = null;
  success.value = false;
  try {
    await api.post('/suggestions', { text: trimmed, category: category.value });
    success.value = true;
    text.value = '';
    category.value = '';
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
      <h1 class="text-xl font-bold">Предложение изменений</h1>
    </div>

    <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-4">
      Опишите идею по улучшению приложения и выберите категорию.
    </p>

    <form @submit.prevent="submit" class="space-y-4">
      <div>
        <label for="suggestion-category" class="block text-sm font-medium mb-2">Категория</label>
        <select
          id="suggestion-category"
          v-model="category"
          class="w-full px-3 py-2 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] border border-[var(--tg-theme-hint-color,#999)]/20"
          :disabled="loading"
        >
          <option value="">Выберите категорию</option>
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div>
        <label for="suggestion-text" class="block text-sm font-medium mb-2">Текст</label>
        <textarea
          id="suggestion-text"
          v-model="text"
          class="w-full min-h-[120px] p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)] border border-[var(--tg-theme-hint-color,#999)]/20 resize-y"
          placeholder="Опишите ваше предложение..."
          maxlength="2000"
          :disabled="loading"
        />
        <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-1">{{ text.length }} / 2000</p>
      </div>

      <button
        type="submit"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] disabled:opacity-50"
        :disabled="loading || !text?.trim() || !category"
      >
        {{ loading ? 'Отправка…' : 'Отправить' }}
      </button>
    </form>

    <p v-if="success" class="mt-4 text-sm text-green-600 dark:text-green-400">
      Спасибо! Предложение отправлено.
    </p>
    <p v-if="error" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
  </div>
</template>
