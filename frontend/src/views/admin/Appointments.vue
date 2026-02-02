<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const appointments = ref([]);
const loading = ref(true);
const error = ref(null);
const updatingId = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    appointments.value = await api.get('/crm/appointments');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
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
        ← Back
      </button>
      <h1 class="text-2xl font-bold">Appointments</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Loading…</div>

    <ul v-else class="space-y-3">
      <li
        v-for="a in appointments"
        :key="a.id"
        class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]"
      >
        <div class="font-medium">{{ a.date }} {{ a.startTime }}</div>
        <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">
          {{ a.client?.name }} · {{ a.service?.name }}
        </div>
        <div class="flex items-center gap-2 mt-2">
          <span class="text-sm capitalize px-2 py-0.5 rounded bg-[var(--tg-theme-section-bg-color,#e5e5e5)]">{{ a.status }}</span>
          <template v-if="a.status === 'scheduled'">
            <button
              type="button"
              class="text-sm px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50"
              :disabled="updatingId === a.id"
              @click="setStatus(a.id, 'done')"
            >
              Done
            </button>
            <button
              type="button"
              class="text-sm px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50"
              :disabled="updatingId === a.id"
              @click="setStatus(a.id, 'cancelled')"
            >
              Cancel
            </button>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>
