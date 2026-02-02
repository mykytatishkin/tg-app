<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const clients = ref([]);
const loading = ref(true);
const error = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    clients.value = await api.get('/crm/clients');
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

function goToClient(id) {
  hapticFeedback?.('light');
  router.push(`/admin/clients/${id}`);
}

function formatLastVisit(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
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
      <h1 class="text-2xl font-bold">Клиенты</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <ul v-else class="space-y-3">
      <li
        v-for="c in clients"
        :key="c.id"
        class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] active:opacity-90"
        @click="goToClient(c.id)"
      >
        <div class="font-medium">{{ c.name }}</div>
        <div v-if="c.phone" class="text-sm text-[var(--tg-theme-hint-color,#999)]">{{ c.phone }}</div>
        <div v-if="c.username" class="text-sm text-[var(--tg-theme-hint-color,#999)]">@{{ c.username }}</div>
        <div class="text-sm mt-2 text-[var(--tg-theme-hint-color,#999)]">
          {{ c.visitCount ?? 0 }} записей
          <span v-if="c.lastVisitAt"> · последняя {{ formatLastVisit(c.lastVisitAt) }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>
