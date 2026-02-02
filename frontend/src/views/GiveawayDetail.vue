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
const verifyingId = ref(null);

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
const verifiedCount = computed(() => participants.value.filter((p) => p.conditionsVerified).length);

const myParticipant = computed(() => {
  if (!user.value?.id || !participants.value.length) return null;
  return participants.value.find((p) => p.userId === user.value.id) ?? null;
});
const isPendingVerification = computed(() => myParticipant.value && !myParticipant.value.conditionsVerified);

const canDraw = computed(() => {
  const g = giveaway.value;
  return isMasterOrAdmin.value && g?.status === 'active' && verifiedCount.value > 0;
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

async function verifyParticipant(participantId) {
  verifyingId.value = participantId;
  error.value = null;
  try {
    await api.put(`/giveaways/${id.value}/participants/${participantId}/verify`);
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    verifyingId.value = null;
  }
}

async function remove() {
  if (!isMasterOrAdmin.value || !confirm('Удалить этот розыгрыш?')) return;
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
  const map = { draft: 'Черновик', active: 'Активен', ended: 'Завершён' };
  return map[s] ?? s;
}

function formatDateRange(start, end) {
  if (!start || !end) return '';
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} – ${e.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

function clientStatusMessage(g) {
  if (!g || g.status !== 'active') return null;
  const now = new Date();
  const start = g.startAt ? new Date(g.startAt) : null;
  const end = g.endAt ? new Date(g.endAt) : null;
  if (start && now < start) return 'Участие откроется с начала периода розыгрыша.';
  if (end && now > end) return 'Розыгрыш уже завершён.';
  return null;
}

function conditionsText(conditions) {
  if (!conditions?.length) return null;
  return conditions.map((c) => (c.value ? `${c.type}: ${c.value}` : c.type)).join(', ');
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
      <h1 class="text-2xl font-bold truncate flex-1">Розыгрыш</h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>
    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

    <template v-else-if="giveaway">
      <!-- Card: for client show prize / condition / period; for master same + status -->
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
                giveaway.status === 'active' ? 'bg-neutral-500 text-white' : '',
                giveaway.status === 'ended' ? 'bg-neutral-600 text-neutral-200' : '',
                giveaway.status === 'draft' ? 'bg-neutral-700 text-neutral-300' : '',
              ]"
            >
              {{ statusLabel(giveaway.status) }}
            </span>
          </div>
          <p v-if="giveaway.description" class="text-sm text-[var(--tg-theme-hint-color,#999)] mt-2 whitespace-pre-wrap">
            {{ giveaway.description }}
          </p>
          <template v-if="!isMasterOrAdmin">
            <p v-if="conditionsText(giveaway.conditions)" class="text-sm mt-2 text-[var(--tg-theme-text-color)]">
              {{ conditionsText(giveaway.conditions) }}
            </p>
            <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-2">
              {{ formatDateRange(giveaway.startAt, giveaway.endAt) }}
            </p>
          </template>
          <template v-else>
            <div class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-2">
              {{ giveaway.startAt ? new Date(giveaway.startAt).toLocaleString() : '' }}
              –
              {{ giveaway.endAt ? new Date(giveaway.endAt).toLocaleString() : '' }}
            </div>
            <div v-if="giveaway.conditions?.length" class="mt-3 text-sm">
              <span class="font-medium">Условия:</span>
              <ul class="list-disc list-inside mt-1 text-[var(--tg-theme-hint-color,#999)]">
                <li v-for="(c, i) in giveaway.conditions" :key="i">
                  {{ c.type }}{{ c.value ? `: ${c.value}` : '' }}
                </li>
              </ul>
            </div>
          </template>
        </div>
      </div>

      <!-- Master actions -->
      <div v-if="isMasterOrAdmin" class="space-y-3 mb-6">
        <template v-if="giveaway.status === 'draft'">
          <button
            type="button"
            class="w-full py-3 rounded-xl font-medium bg-neutral-500 text-white"
            @click="setStatus('active')"
          >
            Активировать розыгрыш
          </button>
        </template>
        <template v-else-if="giveaway.status === 'active'">
          <p class="text-sm text-[var(--tg-theme-hint-color,#999)]">
            {{ verifiedCount }} проверено / {{ participants.length }} участников
          </p>
          <button
            type="button"
            class="w-full py-3 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-60"
            :disabled="!canDraw || drawing"
            @click="draw"
          >
            {{ drawing ? 'Жеребьёвка…' : 'Провести жеребьёвку' }}
          </button>
        </template>
        <template v-if="giveaway.status === 'draft'">
          <button
            type="button"
            class="w-full py-2 rounded-xl text-neutral-400 border border-neutral-500 disabled:opacity-50"
            :disabled="deleting"
            @click="remove"
          >
            {{ deleting ? 'Удаляю…' : 'Удалить розыгрыш' }}
          </button>
        </template>
      </div>

      <!-- Client: participation block -->
      <div v-if="!isMasterOrAdmin" class="mb-6">
        <p v-if="isParticipant && !isPendingVerification" class="text-sm text-neutral-300 font-medium">
          Вы участвуете в розыгрыше.
        </p>
        <p v-else-if="isPendingVerification" class="text-sm text-neutral-400 font-medium">
          Вы подали заявку. Мастер проверит выполнение условий и тогда вы будете участвовать в жеребьёвке.
        </p>
        <template v-else-if="canParticipate">
          <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">
            Выполните условия розыгрыша, затем нажмите «Участвовать». Мастер вручную проверит выполнение.
          </p>
          <button
            type="button"
            class="w-full py-3 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-60"
            :disabled="participating"
            @click="participate"
          >
            {{ participating ? 'Отправляем…' : 'Участвовать' }}
          </button>
        </template>
        <p v-else-if="clientStatusMessage(giveaway)" class="text-sm text-[var(--tg-theme-hint-color,#999)]">
          {{ clientStatusMessage(giveaway) }}
        </p>
        <p v-else-if="giveaway.status === 'ended'" class="text-sm text-[var(--tg-theme-hint-color,#999)]">
          Розыгрыш завершён. Победители указаны ниже.
        </p>
      </div>

      <!-- Participants list (master) -->
      <div v-if="isMasterOrAdmin && participants.length > 0" class="mb-6">
        <h3 class="text-lg font-medium mb-2">Участники</h3>
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

      <!-- Winners (client + master) -->
      <div v-if="giveaway.status === 'ended' && winners.length > 0" class="mb-6">
        <h3 class="text-lg font-medium mb-2">Победители</h3>
        <ul class="space-y-2">
          <li
            v-for="w in winners"
            :key="w.id"
            class="p-3 rounded-lg bg-neutral-700/50 border border-neutral-600 text-sm"
          >
            {{ w.user?.firstName ?? '' }} {{ w.user?.lastName ?? '' }}
            <span v-if="w.user?.username" class="text-[var(--tg-theme-hint-color,#999)]">@{{ w.user.username }}</span>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
