<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const route = useRoute();
const { hapticFeedback } = useTelegramWebApp();

const appointments = ref([]);
const loading = ref(true);
const error = ref(null);
const updatingId = ref(null);
const showPastAndClosed = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const url = showPastAndClosed.value
      ? '/crm/appointments'
      : '/crm/appointments?upcomingOnly=true';
    appointments.value = await api.get(url);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function toggleShowPast() {
  showPastAndClosed.value = !showPastAndClosed.value;
  load();
}

async function setStatus(id, status) {
  updatingId.value = id;
  error.value = null;
  try {
    await api.put(`/crm/appointments/${id}`, { status });
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    updatingId.value = null;
  }
}

function goToDetail(id) {
  hapticFeedback?.('light');
  const query = showPastAndClosed.value ? { showAll: '1' } : undefined;
  router.push({ name: 'AdminAppointmentDetail', params: { id }, query });
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

onMounted(() => {
  showPastAndClosed.value = route.query.showAll === '1';
  load();
});

watch(() => route.query.showAll, (val) => {
  showPastAndClosed.value = val === '1';
  load();
}, { immediate: false });
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
      <h1 class="text-2xl font-bold">Записи</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>

    <label class="flex items-center gap-2 mb-4 cursor-pointer">
      <input
        v-model="showPastAndClosed"
        type="checkbox"
        class="rounded"
        @change="load"
      >
      <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">Показать отменённые и завершённые</span>
    </label>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <ul v-else class="space-y-3">
      <li
        v-for="a in appointments"
        :key="a.id"
        class="p-4 rounded-xl"
        :class="!a.serviceId ? 'bg-purple-100 dark:bg-purple-900/30 border border-purple-300 dark:border-purple-700' : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]'"
      >
        <button
          type="button"
          class="w-full text-left"
          @click="goToDetail(a.id)"
        >
          <div class="font-medium">{{ a.date }} {{ a.startTime ? a.startTime.slice(0, 5) : '' }}</div>
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">
            {{ a.client?.name }} · {{ a.serviceId ? ((a.service?.name ?? '') + (a.service?.price != null ? ' · ' + a.service.price + '+ €' : '')) : 'Для моделей' }}
          </div>
        </button>
        <div class="flex items-center gap-2 mt-2 flex-wrap">
          <span
            v-if="!a.serviceId"
            class="text-sm px-2 py-0.5 rounded bg-purple-500 text-white"
          >Для моделей</span>
          <span
            v-if="a.withDiscount"
            class="text-sm px-2 py-0.5 rounded bg-amber-500 text-white"
          >Со скидкой</span>
          <span
            class="text-sm capitalize px-2 py-0.5 rounded"
            :class="a.status === 'cancelled' ? 'bg-red-600 text-white' : a.status === 'done' ? 'bg-green-600 text-white' : 'bg-[var(--tg-theme-section-bg-color,#e5e5e5)]'"
          >{{ a.status === 'scheduled' ? 'запланировано' : a.status === 'done' ? 'завершено' : 'отменено' }}</span>
          <button
            type="button"
            class="text-sm px-2 py-1 rounded bg-[var(--tg-theme-hint-color,#999)] text-white"
            @click="goToDetail(a.id)"
          >
            Подробнее
          </button>
          <template v-if="a.status === 'scheduled'">
            <button
              type="button"
              class="text-sm px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50"
              :disabled="updatingId === a.id"
              @click.stop="setStatus(a.id, 'done')"
            >
              Завершено
            </button>
            <button
              type="button"
              class="text-sm px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50"
              :disabled="updatingId === a.id"
              @click.stop="setStatus(a.id, 'cancelled')"
            >
              Отменить
            </button>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>
