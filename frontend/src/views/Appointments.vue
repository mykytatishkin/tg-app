<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const appointments = ref([]);
const loading = ref(true);
const error = ref(null);
const cancellingId = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    appointments.value = await api.get('/appointments/mine');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function goToBook() {
  hapticFeedback?.('light');
  router.push('/appointments/book');
}

async function cancelAppointment(id) {
  cancellingId.value = id;
  error.value = null;
  try {
    await api.post(`/appointments/${id}/cancel`);
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    cancellingId.value = null;
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
      <h1 class="text-2xl font-bold">Мои записи</h1>
    </div>

    <button
      class="w-full mb-6 py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
      @click="goToBook"
    >
      Записаться
    </button>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <ul v-else-if="appointments.length === 0" class="text-[var(--tg-theme-hint-color,#999)]">
      Записей пока нет. Запишитесь выше.
    </ul>

    <ul v-else class="space-y-3">
      <li
        v-for="a in appointments"
        :key="a.id"
        class="p-4 rounded-xl"
        :class="!a.serviceId ? 'bg-neutral-700/50 border border-neutral-600' : 'bg-[var(--tg-theme-secondary-bg-color)]'"
      >
        <div class="font-medium">{{ a.date }} {{ a.startTime ? a.startTime.slice(0, 5) : '' }}</div>
        <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">
          <template v-if="a.serviceId">
            {{ a.service?.name }}
            <span v-if="a.service?.durationMinutes"> · {{ a.service.durationMinutes }} min</span>
          </template>
          <span v-else class="text-neutral-400 font-medium">для моделей</span>
        </div>
        <div v-if="a.note" class="text-sm mt-1">{{ a.note }}</div>
        <div v-if="a.status === 'scheduled'" class="mt-2">
          <button
            type="button"
            class="text-sm px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 disabled:opacity-50"
            :disabled="cancellingId === a.id"
            @click="cancelAppointment(a.id)"
          >
            {{ cancellingId === a.id ? 'Отмена…' : 'Отменить запись' }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
