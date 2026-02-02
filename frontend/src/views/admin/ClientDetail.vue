<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const route = useRoute();
const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const client = ref(null);
const loading = ref(true);
const error = ref(null);

const id = computed(() => route.params.id);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    client.value = await api.get(`/crm/clients/${id.value}`);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/admin/clients');
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      <h1 class="text-2xl font-bold truncate flex-1">Клиент</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else-if="client">
      <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-6">
        <div class="font-medium text-lg">{{ client.name }}</div>
        <div v-if="client.phone" class="text-sm text-[var(--tg-theme-hint-color,#999)]">{{ client.phone }}</div>
        <div v-if="client.username" class="text-sm text-[var(--tg-theme-hint-color,#999)]">@{{ client.username }}</div>
        <div v-if="client.notes" class="text-sm mt-2 whitespace-pre-wrap">{{ client.notes }}</div>
      </div>

      <div v-if="client.stats" class="mb-6">
        <h2 class="text-lg font-semibold mb-3">Статистика посещений</h2>
        <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-3">
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">Всего визитов</div>
          <div class="text-2xl font-semibold">{{ client.stats.totalVisits }}</div>
          <div v-if="client.stats.lastVisitAt" class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-1">
            Последний визит: {{ formatDate(client.stats.lastVisitAt) }}
          </div>
        </div>
        <div v-if="client.stats.byService?.length" class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]">
          <div class="text-sm font-medium mb-2">По сервисам</div>
          <ul class="space-y-2">
            <li
              v-for="s in client.stats.byService"
              :key="s.serviceId"
              class="flex justify-between text-sm"
            >
              <span>{{ s.serviceName }}</span>
              <span class="text-[var(--tg-theme-hint-color,#999)]">{{ s.count }} записей</span>
            </li>
          </ul>
        </div>
        <p v-else class="text-sm text-[var(--tg-theme-hint-color,#999)]">Нет записей по сервисам.</p>
      </div>

      <div v-if="client.recentAppointments?.length" class="mb-6">
        <h2 class="text-lg font-semibold mb-3">Последние записи</h2>
        <ul class="space-y-2">
          <li
            v-for="a in client.recentAppointments"
            :key="a.id"
            class="flex justify-between items-center p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-sm"
          >
            <span>{{ formatDate(a.date) }} {{ a.startTime?.slice(0, 5) }}</span>
            <span class="text-[var(--tg-theme-hint-color,#999)]">{{ a.serviceName ?? '—' }} · {{ a.status === 'scheduled' ? 'запланировано' : a.status === 'done' ? 'завершено' : 'отменено' }}</span>
          </li>
        </ul>
      </div>
      
    </template>
  </div>
</template>
