<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const form = ref({
  title: '',
  description: '',
  imageUrl: '',
  startAt: '',
  endAt: '',
  winnerCount: 1,
});
const submitting = ref(false);
const error = ref(null);

function defaultDates() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  form.value.startAt = start.toISOString().slice(0, 16);
  form.value.endAt = end.toISOString().slice(0, 16);
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/giveaways');
}

async function submit() {
  if (!form.value.title?.trim()) {
    error.value = 'Введите название.';
    return;
  }
  if (!form.value.startAt || !form.value.endAt) {
    error.value = 'Укажите дату и время начала и окончания.';
    return;
  }
  const start = new Date(form.value.startAt);
  const end = new Date(form.value.endAt);
  if (end <= start) {
    error.value = 'Окончание должно быть позже начала.';
    return;
  }
  const count = Number(form.value.winnerCount);
  if (count < 1) {
    error.value = 'Количество победителей — минимум 1.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const created = await api.post('/giveaways', {
      title: form.value.title.trim(),
      description: form.value.description?.trim() || undefined,
      imageUrl: form.value.imageUrl?.trim() || undefined,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      winnerCount: count,
    });
    hapticFeedback?.('light');
    router.replace(`/giveaways/${created.id}`);
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}

defaultDates();
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color,#000)]">
    <div class="flex items-center gap-3 mb-6">
      <button
        class="p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f0f0f0)]"
        @click="goBack"
      >
        ← Назад
      </button>
      <h1 class="text-2xl font-bold">Новый розыгрыш</h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>

    <form class="space-y-4" @submit.prevent="submit">
      <div>
        <label for="giveaway-title" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Название *</label>
        <input
          id="giveaway-title"
          v-model="form.title"
          type="text"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          placeholder="e.g. Free manicure"
        >
      </div>
      <div>
        <label for="giveaway-desc" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Описание</label>
        <textarea
          id="giveaway-desc"
          v-model="form.description"
          rows="3"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          placeholder="What participants need to do..."
        />
      </div>
      <div>
        <label for="giveaway-image" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Ссылка на изображение</label>
        <input
          id="giveaway-image"
          v-model="form.imageUrl"
          type="url"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          placeholder="https://..."
        >
      </div>
      <div>
        <label for="giveaway-start" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Начало</label>
        <input
          id="giveaway-start"
          v-model="form.startAt"
          type="datetime-local"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
      </div>
      <div>
        <label for="giveaway-end" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">End</label>
        <input
          id="giveaway-end"
          v-model="form.endAt"
          type="datetime-local"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
      </div>
      <div>
        <label for="giveaway-winners" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Количество победителей</label>
        <input
          id="giveaway-winners"
          v-model.number="form.winnerCount"
          type="number"
          min="1"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
      </div>
      <div class="flex gap-2 pt-2">
        <button
          type="submit"
          class="flex-1 py-3 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-60"
          :disabled="submitting"
        >
          {{ submitting ? 'Создаю…' : 'Создать' }}
        </button>
        <button
          type="button"
          class="py-3 px-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#e5e5e5)]"
          @click="goBack"
        >
          Отмена
        </button>
      </div>
    </form>
  </div>
</template>
