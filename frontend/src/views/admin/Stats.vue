<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const stats = ref(null);
const loading = ref(true);
const error = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    stats.value = await api.get('/crm/stats');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

onMounted(load);
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color,#fff)] text-[var(--tg-theme-text-color,#000)]">
    <div class="flex items-center gap-3 mb-6">
      <button
        class="p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f0f0f0)]"
        @click="goBack"
      >
        ← Назад
      </button>
      <h1 class="text-2xl font-bold">Статистика</h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else-if="stats">
      <div class="grid gap-4 mb-6">
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Всего записей</div>
          <div class="text-2xl font-semibold">{{ stats.totalAppointments }}</div>
        </div>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Клиентов</div>
          <div class="text-2xl font-semibold">{{ stats.totalClients }}</div>
        </div>
      </div>

      <h2 class="text-lg font-semibold mb-3">Записи по сервисам</h2>
      <p v-if="!stats.byService?.length" class="text-sm text-[var(--tg-theme-hint-color,#999)]">Нет данных.</p>
      <ul v-else class="space-y-2">
        <li
          v-for="s in stats.byService"
          :key="s.serviceId"
          class="flex justify-between items-center p-3 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]"
        >
          <span class="font-medium">{{ s.serviceName }}</span>
          <span class="text-[var(--tg-theme-hint-color,#999)]">{{ s.count }} записей</span>
        </li>
      </ul>
    </template>
  </div>
</template>
