<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const slots = ref([]);
const loading = ref(true);
const error = ref(null);
const showForm = ref(false);
const form = ref({ date: '', startTime: '09:00', endTime: '18:00' });
const submitting = ref(false);
const deletingId = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    slots.value = await api.get('/crm/availability');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function addSlot() {
  if (!form.value.date || !form.value.startTime || !form.value.endTime) {
    error.value = 'Fill date, start and end time.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    await api.post('/crm/availability', {
      date: form.value.date,
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      isAvailable: true,
    });
    hapticFeedback?.('light');
    showForm.value = false;
    form.value = { date: '', startTime: '09:00', endTime: '18:00' };
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}

async function removeSlot(id) {
  deletingId.value = id;
  error.value = null;
  try {
    await api.delete(`/crm/availability/${id}`);
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    deletingId.value = null;
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
      <h1 class="text-2xl font-bold">Availability</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>

    <button
      v-if="!showForm"
      type="button"
      class="w-full mb-6 py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)]"
      @click="showForm = true"
    >
      Add slot
    </button>

    <div v-else class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] space-y-3">
      <input
        v-model="form.date"
        type="date"
        class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
      >
      <div class="flex gap-2">
        <input
          v-model="form.startTime"
          type="time"
          class="flex-1 p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
        <input
          v-model="form.endTime"
          type="time"
          class="flex-1 p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 rounded-lg bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-60"
          :disabled="submitting"
          @click="addSlot"
        >
          {{ submitting ? 'Adding…' : 'Add' }}
        </button>
        <button
          type="button"
          class="py-2 px-4 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e5e5e5)]"
          @click="showForm = false"
        >
          Cancel
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Loading…</div>

    <ul v-else class="space-y-3">
      <li
        v-for="s in slots"
        :key="s.id"
        class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] flex items-center justify-between"
      >
        <div>
          <div class="font-medium">{{ s.date }}</div>
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">
            {{ s.startTime }} – {{ s.endTime }}
            <span v-if="!s.isAvailable" class="text-red-500"> (unavailable)</span>
          </div>
        </div>
        <button
          type="button"
          class="text-sm px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50"
          :disabled="deletingId === s.id"
          @click="removeSlot(s.id)"
        >
          Delete
        </button>
      </li>
    </ul>
  </div>
</template>
