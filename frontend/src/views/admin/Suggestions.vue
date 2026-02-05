<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';
import { api } from '../../api/client';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const list = ref([]);
const loading = ref(true);
const error = ref(null);
const updatingId = ref(null);

const STATUS_LABELS = {
  pending: 'На рассмотрении',
  accepted: 'Принято',
  rejected: 'Отклонено',
};

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function userName(item) {
  if (!item?.user) return '—';
  const u = item.user;
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.username || 'Пользователь';
}

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? '—';
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    list.value = await api.get('/suggestions');
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

async function setStatus(id, status) {
  updatingId.value = id;
  error.value = null;
  try {
    await api.patch(`/suggestions/${id}/status`, { status });
    const item = list.value.find((x) => x.id === id);
    if (item) item.status = status;
  } catch (e) {
    error.value = e.message || 'Ошибка обновления';
  } finally {
    updatingId.value = null;
  }
}

onMounted(load);
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
      <h1 class="text-xl font-bold">Предложения</h1>
    </div>

    <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-4">
      Предложения от пользователей и мастеров. При новом предложении вы получаете уведомление в боте.
    </p>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>
    <p v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

    <div v-else-if="list.length === 0" class="text-[var(--tg-theme-hint-color,#999)]">
      Пока нет предложений.
    </div>

    <ul v-else class="space-y-4">
      <li
        v-for="item in list"
        :key="item.id"
        class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-hint-color,#999)]/10"
      >
        <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <span class="text-xs font-medium text-[var(--tg-theme-hint-color,#999)]">
            {{ item.category }}
          </span>
          <span
            class="text-xs px-2 py-0.5 rounded"
            :class="{
              'bg-amber-500/20 text-amber-700 dark:text-amber-400': item.status === 'pending',
              'bg-green-500/20 text-green-700 dark:text-green-400': item.status === 'accepted',
              'bg-red-500/20 text-red-700 dark:text-red-400': item.status === 'rejected',
            }"
          >
            {{ statusLabel(item.status) }}
          </span>
          <span class="text-xs text-[var(--tg-theme-hint-color,#999)]">
            {{ formatDate(item.createdAt) }}
          </span>
        </div>
        <p class="text-sm font-medium text-[var(--tg-theme-text-color)] mb-1">
          {{ userName(item) }}
        </p>
        <p class="text-sm text-[var(--tg-theme-text-color)] whitespace-pre-wrap mb-3">{{ item.text }}</p>
        <div v-if="item.status === 'pending'" class="flex gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white disabled:opacity-50"
            :disabled="updatingId === item.id"
            @click="setStatus(item.id, 'accepted')"
          >
            {{ updatingId === item.id ? '…' : 'Принять' }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white disabled:opacity-50"
            :disabled="updatingId === item.id"
            @click="setStatus(item.id, 'rejected')"
          >
            {{ updatingId === item.id ? '…' : 'Отклонить' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
