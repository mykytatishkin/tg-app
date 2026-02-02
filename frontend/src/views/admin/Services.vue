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
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Loading…</div>

    <ul v-else class="space-y-3">
      <li
        v-for="s in services"
        :key="s.id"
        class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]"
      >
        <div class="font-medium">{{ s.name }}</div>
        <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">
          {{ s.durationMinutes }} min · {{ s.price }}
        </div>
      </li>
    </ul>
  </div>
</template>
