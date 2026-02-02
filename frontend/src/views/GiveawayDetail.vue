<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const route = useRoute();
const router = useRouter();
const { user } = useAuth();
const { hapticFeedback } = useTelegramWebApp();

const giveaway = ref(null);
const loading = ref(true);
const error = ref(null);
const participating = ref(false);
const drawing = ref(false);
const deleting = ref(false);

const id = computed(() => route.params.id);

const isMasterOrAdmin = computed(() => !!user.value?.isMaster || !!user.value?.isAdmin);

const isParticipant = computed(() => {
  if (!giveaway.value?.participants || !user.value?.id) return false;
  return giveaway.value.participants.some((p) => p.userId === user.value.id);
});

const canParticipate = computed(() => {
  const g = giveaway.value;
  if (!g || g.status !== 'active') return false;
  if (isParticipant.value) return false;
  const now = new Date();
  const start = g.startAt ? new Date(g.startAt) : null;
  const end = g.endAt ? new Date(g.endAt) : null;
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
});

const participants = computed(() => giveaway.value?.participants ?? []);
const winners = computed(() => giveaway.value?.winners ?? []);

const canDraw = computed(() => {
  const g = giveaway.value;
  return isMasterOrAdmin.value && g?.status === 'active' && participants.value.length > 0;
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    giveaway.value = await api.get(`/giveaways/${id.value}`);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function participate() {
  if (!canParticipate.value) return;
  participating.value = true;
  error.value = null;
  try {
    await api.post(`/giveaways/${id.value}/participate`);
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    participating.value = false;
  }
}

async function setStatus(status) {
  error.value = null;
  try {
    await api.put(`/giveaways/${id.value}`, { status });
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  }
}

async function draw() {
  if (!canDraw.value) return;
  drawing.value = true;
  error.value = null;
  try {
    await api.post(`/giveaways/${id.value}/draw`);
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    drawing.value = false;
  }
}

async function remove() {
  if (!isMasterOrAdmin.value || !confirm('Delete this giveaway?')) return;
  deleting.value = true;
  error.value = null;
  try {
    await api.delete(`/giveaways/${id.value}`);
    hapticFeedback?.('light');
    router.replace('/giveaways');
  } catch (e) {
    error.value = e.message;
  } finally {
    deleting.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/giveaways');
}

function statusLabel(s) {
  const map = { draft: 'Draft', active: 'Active', ended: 'Ended' };
  return map[s] ?? s;
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
      <h1 class="text-2xl font-bold truncate flex-1">Giveaway</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Loading…</div>

    <template v-else-if="giveaway">
      <div class="rounded-xl overflow-hidden bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-4">
        <img
          v-if="giveaway.imageUrl"
          :src="giveaway.imageUrl"
          :alt="giveaway.title"
          class="w-full h-40 object-cover"
          @error="(e) => (e.target.style.display = 'none')"
        >
        <div class="p-4">
          <div class="flex items-start justify-between gap-2">
            <h2 class="text-xl font-semibold">{{ giveaway.title }}</h2>
            <span
              v-if="isMasterOrAdmin"
              :class="[
                'shrink-0 text-xs px-2 py-0.5 rounded',
                giveaway.status === 'active' ? 'bg-green-100 text-green-800' : '',
                giveaway.status === 'ended' ? 'bg-gray-200 text-gray-700' : '',
                giveaway.status === 'draft' ? 'bg-amber-100 text-amber-800' : '',
              ]"
            >
              {{ statusLabel(giveaway.status) }}
            </span>
          </div>
          <p v-if="giveaway.description" class="text-sm text-[var(--tg-theme-hint-color,#999)] mt-2 whitespace-pre-wrap">
            {{ giveaway.description }}
          </p>
          <div class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-2">
            {{ giveaway.startAt ? new Date(giveaway.startAt).toLocaleString() : '' }}
            –
            {{ giveaway.endAt ? new Date(giveaway.endAt).toLocaleString() : '' }}
          </div>
          <div v-if="giveaway.conditions?.length" class="mt-3 text-sm">
            <span class="font-medium">Conditions:</span>
            <ul class="list-disc list-inside mt-1 text-[var(--tg-theme-hint-color,#999)]">
              <li v-for="(c, i) in giveaway.conditions" :key="i">
                {{ c.type }}{{ c.value ? `: ${c.value}` : '' }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Master actions -->
      <div v-if="isMasterOrAdmin" class="space-y-3 mb-6">
        <template v-if="giveaway.status === 'draft'">
          <button
            type="button"
            class="w-full py-3 rounded-xl font-medium bg-green-600 text-white"
            @click="setStatus('active')"
          >
            Activate giveaway
          </button>
        </template>
        <template v-else-if="giveaway.status === 'active'">
          <p class="text-sm text-[var(--tg-theme-hint-color,#999)]">
            {{ participants.length }} participant(s)
          </p>
          <button
            type="button"
            class="w-full py-3 rounded-xl font-medium bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-60"
            :disabled="!canDraw || drawing"
            @click="draw"
          >
            {{ drawing ? 'Drawing…' : 'Draw winner(s)' }}
          </button>
        </template>
        <template v-if="giveaway.status === 'draft'">
          <button
            type="button"
            class="w-full py-2 rounded-xl text-red-600 border border-red-600 disabled:opacity-50"
            :disabled="deleting"
            @click="remove"
          >
            {{ deleting ? 'Deleting…' : 'Delete giveaway' }}
          </button>
        </template>
      </div>

      <!-- Participant actions -->
      <div v-if="!isMasterOrAdmin" class="mb-6">
        <p v-if="isParticipant" class="text-sm text-green-600 font-medium">
          You are participating.
        </p>
        <button
          v-else-if="canParticipate"
          type="button"
          class="w-full py-3 rounded-xl font-medium bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-60"
          :disabled="participating"
          @click="participate"
        >
          {{ participating ? 'Joining…' : 'Participate' }}
        </button>
        <p v-else-if="giveaway.status === 'active'" class="text-sm text-[var(--tg-theme-hint-color,#999)]">
          Outside participation period or already ended.
        </p>
      </div>

      <!-- Participants list (master) -->
      <div v-if="isMasterOrAdmin && participants.length > 0" class="mb-6">
        <h3 class="text-lg font-medium mb-2">Participants</h3>
        <ul class="space-y-2">
          <li
            v-for="p in participants"
            :key="p.id"
            class="p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-sm"
          >
            {{ p.user?.firstName ?? '' }} {{ p.user?.lastName ?? '' }}
            <span v-if="p.user?.username" class="text-[var(--tg-theme-hint-color,#999)]">@{{ p.user.username }}</span>
          </li>
        </ul>
      </div>

      <!-- Winners -->
      <div v-if="giveaway.status === 'ended' && winners.length > 0" class="mb-6">
        <h3 class="text-lg font-medium mb-2">Winners</h3>
        <ul class="space-y-2">
          <li
            v-for="w in winners"
            :key="w.id"
            class="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm"
          >
            {{ w.user?.firstName ?? '' }} {{ w.user?.lastName ?? '' }}
            <span v-if="w.user?.username" class="text-[var(--tg-theme-hint-color,#999)]">@{{ w.user.username }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
