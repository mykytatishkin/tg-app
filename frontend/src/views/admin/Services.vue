<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const services = ref([]);
const loading = ref(true);
const error = ref(null);
const showForm = ref(false);
const form = ref({ name: '', durationMinutes: 60, price: '' });
const submitting = ref(false);
const deletingId = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    services.value = await api.get('/crm/services');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function openAddForm() {
  hapticFeedback?.('light');
  form.value = { name: '', durationMinutes: 60, price: '' };
  showForm.value = true;
  error.value = null;
}

async function addService() {
  if (!form.value.name?.trim()) {
    error.value = 'Enter service name.';
    return;
  }
  const duration = Number(form.value.durationMinutes);
  const price = form.value.price === '' ? undefined : Number(form.value.price);
  if (duration < 1 || (price !== undefined && price < 0)) {
    error.value = 'Duration must be at least 1 min; price must be 0 or more.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    await api.post('/crm/services', {
      name: form.value.name.trim(),
      durationMinutes: duration,
      price: price,
    });
    hapticFeedback?.('light');
    showForm.value = false;
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}

async function removeService(id) {
  deletingId.value = id;
  error.value = null;
  try {
    await api.delete(`/crm/services/${id}`);
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
      <h1 class="text-2xl font-bold">Services</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>

    <div v-if="!showForm" class="mb-6">
      <button
        type="button"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)]"
        @click="openAddForm"
      >
        Add service
      </button>
    </div>

    <div v-else class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] space-y-3">
      <div>
        <label class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Name</label>
        <input
          v-model="form.name"
          type="text"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          placeholder="e.g. Manicure"
        >
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Duration (min)</label>
        <input
          v-model.number="form.durationMinutes"
          type="number"
          min="1"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
      </div>
      <div>
        <label class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Price (€, optional)</label>
        <input
          v-model="form.price"
          type="number"
          min="0"
          step="0.01"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#fff)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          placeholder="0"
        >
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 rounded-lg bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-60"
          :disabled="submitting"
          @click="addService"
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
        v-for="s in services"
        :key="s.id"
        class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <div class="font-medium">{{ s.name }}</div>
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">
            {{ s.durationMinutes }} min
            <span v-if="s.price != null"> · {{ s.price }} €</span>
          </div>
        </div>
        <button
          type="button"
          class="shrink-0 text-sm px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50"
          :disabled="deletingId === s.id"
          @click="removeService(s.id)"
        >
          Delete
        </button>
      </li>
    </ul>
  </div>
</template>
