<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { user } = useAuth();
const { hapticFeedback } = useTelegramWebApp();

const giveaways = ref([]);
const loading = ref(true);
const error = ref(null);

const isMasterOrAdmin = computed(() => !!user.value?.isMaster || !!user.value?.isAdmin);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const forMaster = isMasterOrAdmin.value ? 'true' : '';
    giveaways.value = await api.get(`/giveaways${forMaster ? '?forMaster=true' : ''}`);
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

function goToCreate() {
  hapticFeedback?.('light');
  router.push('/giveaways/new');
}

function goToDetail(id) {
  hapticFeedback?.('light');
  router.push(`/giveaways/${id}`);
}

function statusLabel(status) {
  const map = { draft: 'Draft', active: 'Active', ended: 'Ended' };
  return map[status] ?? status;
}

function statusClass(status) {
  if (status === 'active') return 'bg-green-100 text-green-800';
  if (status === 'ended') return 'bg-gray-200 text-gray-700';
  return 'bg-amber-100 text-amber-800';
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
      <h1 class="text-2xl font-bold">Giveaways</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>

    <div v-if="isMasterOrAdmin" class="mb-6">
      <button
        type="button"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)]"
        @click="goToCreate"
      >
        Create giveaway
      </button>
    </div>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Loading…</div>

    <template v-else>
      <p v-if="giveaways.length === 0" class="text-[var(--tg-theme-hint-color,#999)]">
        {{ isMasterOrAdmin ? 'No giveaways yet. Create one above.' : 'No active giveaways at the moment.' }}
      </p>
      <ul v-else class="space-y-3">
        <li
          v-for="g in giveaways"
          :key="g.id"
          class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] active:opacity-90"
          @click="goToDetail(g.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="font-medium">{{ g.title }}</div>
              <div v-if="g.description" class="text-sm text-[var(--tg-theme-hint-color,#999)] line-clamp-2 mt-0.5">
                {{ g.description }}
              </div>
              <div class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-2">
                {{ g.startAt ? new Date(g.startAt).toLocaleDateString() : '' }}
                –
                {{ g.endAt ? new Date(g.endAt).toLocaleDateString() : '' }}
              </div>
            </div>
            <span
              v-if="isMasterOrAdmin"
              :class="['shrink-0 text-xs px-2 py-0.5 rounded', statusClass(g.status)]"
            >
              {{ statusLabel(g.status) }}
            </span>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
