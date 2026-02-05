<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const profile = ref(null);
const instagram = ref('');
const loading = ref(true);
const saving = ref(false);
const error = ref(null);
const message = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  message.value = null;
  try {
    profile.value = await api.get('/appointments/profile');
    if (profile.value) {
      instagram.value = profile.value.instagram ?? '';
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = null;
  message.value = null;
  try {
    const res = await api.patch('/appointments/profile', { instagram: instagram.value?.trim() || undefined });
    profile.value = res;
    if (res) instagram.value = res.instagram ?? '';
    message.value = 'Сохранено.';
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

onMounted(load);
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
      <h1 class="text-2xl font-bold">Мой профиль</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>
    <p v-if="message" class="text-[var(--tg-theme-hint-color,#999)] mb-4">{{ message }}</p>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else-if="profile">
      <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-6">
        <div class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-1">Имя</div>
        <div class="font-medium">{{ profile.name }}</div>
      </div>
      <form class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-6" @submit.prevent="save">
        <label for="profile-instagram" class="block text-sm font-medium mb-2">Instagram</label>
        <input
          id="profile-instagram"
          v-model="instagram"
          type="text"
          placeholder="@username или ссылка на профиль"
          class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#e8e8e8)] mb-4"
        />
        <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mb-4">
          Укажите ник или ссылку — мастер сможет видеть ваш профиль. Вход в Instagram не требуется.
        </p>
        <button
          type="submit"
          class="px-4 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
          :disabled="saving"
        >
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </button>
      </form>
    </template>

    <template v-else>
      <p class="text-[var(--tg-theme-hint-color,#999)]">
        Ваш профиль появится после первой записи к мастеру. Тогда здесь можно будет указать Instagram.
      </p>
    </template>

    <div class="mt-6 pt-6 border-t border-[var(--tg-theme-section-separator-color,#e0e0e0)]">
      <h2 class="text-lg font-medium mb-2">Предложение изменений</h2>
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">
        Есть идея по улучшению приложения? Опишите её — мы учтём.
      </p>
      <RouterLink
        to="/suggestions/new"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)] no-underline font-medium"
      >
        Оставить предложение →
      </RouterLink>
    </div>
  </div>
</template>
