<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../../composables/useAuth';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';
import { api } from '../../api/client';

const router = useRouter();
const { user, refreshUser } = useAuth();
const { hapticFeedback } = useTelegramWebApp();

const options = ref([]);
const newOption = ref('');
const saving = ref(false);
const error = ref(null);

onMounted(async () => {
  await refreshUser();
  options.value = Array.isArray(user.value?.drinkOptions) ? [...user.value.drinkOptions] : [];
});

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

function addOption() {
  const v = newOption.value?.trim();
  if (!v) return;
  if (options.value.includes(v)) return;
  options.value.push(v);
  newOption.value = '';
}

function removeOption(idx) {
  hapticFeedback?.('light');
  options.value.splice(idx, 1);
}

async function save() {
  hapticFeedback?.('light');
  saving.value = true;
  error.value = null;
  try {
    await api.patch('/auth/me', { drinkOptions: options.value });
    await refreshUser();
    error.value = null;
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-text-color)]">
    <div class="flex items-center gap-3 mb-6">
      <button
        type="button"
        class="p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)]"
        @click="goBack"
      >
        ← Назад
      </button>
      <h1 class="text-2xl font-bold">Напитки для клиентов</h1>
    </div>

    <p class="text-sm text-[var(--tg-theme-hint-color)] mb-4">
      За 5–10 минут до сеанса клиенту придёт напоминание «Желаете что-то выпить?» с кнопками из этого списка. Выбор клиента отправится вам в бот.
    </p>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>

    <div class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)] space-y-3">
      <label for="drink-option-input" class="block text-sm font-medium text-[var(--tg-theme-hint-color)]">Добавить вариант</label>
      <div class="flex gap-2">
        <input
          id="drink-option-input"
          v-model="newOption"
          type="text"
          placeholder="Напр. Кофе, Чай, Вода"
          class="flex-1 p-3 rounded-lg bg-[var(--tg-theme-bg-color)] border border-[var(--tg-theme-section-separator-color)]"
          @keydown.enter.prevent="addOption"
        >
        <button
          type="button"
          class="py-2 px-4 rounded-lg bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] border border-[var(--tg-theme-section-separator-color)]"
          @click="addOption"
        >
          Добавить
        </button>
      </div>
    </div>

    <ul v-if="options.length" class="space-y-2 mb-6">
      <li
        v-for="(opt, idx) in options"
        :key="idx"
        class="p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-section-separator-color)] flex items-center justify-between gap-2"
      >
        <span>{{ opt }}</span>
        <button
          type="button"
          class="text-sm px-2 py-1 rounded border border-[var(--tg-theme-section-separator-color)] bg-[var(--tg-theme-section-bg-color)] text-[var(--tg-theme-text-color)]"
          @click="removeOption(idx)"
        >
          Удалить
        </button>
      </li>
    </ul>
    <p v-else class="text-[var(--tg-theme-hint-color)] mb-6">Пока нет вариантов. Добавьте выше.</p>

    <button
      type="button"
      class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)] border border-[var(--tg-theme-section-separator-color)] disabled:opacity-60"
      :disabled="saving"
      @click="save"
    >
      {{ saving ? 'Сохраняю…' : 'Сохранить список' }}
    </button>
  </div>
</template>
