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
const actionId = ref(null);
const filterMasterId = ref('');

const STATUS_LABELS = {
  pending: 'На рассмотрении',
  accepted: 'Подтверждён',
  declined: 'Отклонён',
};

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  return String(timeStr).slice(0, 5);
}

function clientName(item) {
  return item?.client?.name ?? '—';
}

function masterName(item) {
  if (!item?.master) return '—';
  const m = item.master;
  return [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Мастер';
}

function serviceName(item) {
  return item?.service?.name ?? '—';
}

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? '—';
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const qs = filterMasterId.value ? `?masterId=${encodeURIComponent(filterMasterId.value)}` : '';
    list.value = await api.get(`/custom-time-requests${qs}`);
  } catch (e) {
    error.value = e.message || 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

async function accept(id) {
  actionId.value = id;
  error.value = null;
  try {
    await api.patch(`/custom-time-requests/${id}/accept`, {});
    const item = list.value.find((x) => x.id === id);
    if (item) item.status = 'accepted';
  } catch (e) {
    error.value = e.message || 'Ошибка';
  } finally {
    actionId.value = null;
  }
}

async function decline(id) {
  actionId.value = id;
  error.value = null;
  try {
    await api.patch(`/custom-time-requests/${id}/decline`, {});
    const item = list.value.find((x) => x.id === id);
    if (item) item.status = 'declined';
  } catch (e) {
    error.value = e.message || 'Ошибка';
  } finally {
    actionId.value = null;
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
      <h1 class="text-xl font-bold">Запросы своего времени</h1>
    </div>

    <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-4">
      Клиентки предлагают удобное для них время за доплату. Подтвердите запрос — создастся запись и слот; клиентке придёт уведомление.
    </p>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>
    <p v-else-if="error" class="text-sm text-red-600 dark:text-red-400 mb-4">{{ error }}</p>

    <div v-else-if="list.length === 0" class="text-[var(--tg-theme-hint-color,#999)]">
      Нет запросов.
    </div>

    <ul v-else class="space-y-4">
      <li
        v-for="item in list"
        :key="item.id"
        class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color)] border border-[var(--tg-theme-hint-color,#999)]/10"
      >
        <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <span
            class="text-xs px-2 py-0.5 rounded"
            :class="{
              'bg-amber-500/20 text-amber-700 dark:text-amber-400': item.status === 'pending',
              'bg-green-500/20 text-green-700 dark:text-green-400': item.status === 'accepted',
              'bg-neutral-500/20 text-neutral-600 dark:text-neutral-400': item.status === 'declined',
            }"
          >
            {{ statusLabel(item.status) }}
          </span>
          <span class="text-xs text-[var(--tg-theme-hint-color,#999)]">
            {{ formatDate(item.requestedDate) }} {{ formatTime(item.requestedStartTime) }}
          </span>
        </div>
        <p class="text-sm font-medium text-[var(--tg-theme-text-color)]">
          {{ clientName(item) }} · {{ serviceName(item) }}
        </p>
        <p v-if="item.master" class="text-xs text-[var(--tg-theme-hint-color,#999)]">
          {{ masterName(item) }}
        </p>
        <p class="text-sm font-medium text-[var(--tg-theme-text-color)] mt-1">
          Доплата +{{ item.feeAmount != null ? Number(item.feeAmount) : '—' }} €
        </p>
        <p v-if="item.note" class="text-sm text-[var(--tg-theme-hint-color,#999)] mt-1 whitespace-pre-wrap">
          {{ item.note }}
        </p>
        <div v-if="item.status === 'pending'" class="flex gap-2 mt-3">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white disabled:opacity-50"
            :disabled="actionId === item.id"
            @click="accept(item.id)"
          >
            {{ actionId === item.id ? '…' : 'Подтвердить' }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white disabled:opacity-50"
            :disabled="actionId === item.id"
            @click="decline(item.id)"
          >
            {{ actionId === item.id ? '…' : 'Отклонить' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
