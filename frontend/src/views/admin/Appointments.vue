<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';
import { useAdminMasters } from '../../composables/useAdminMasters';

const router = useRouter();
const route = useRoute();
const { hapticFeedback } = useTelegramWebApp();
const { isAdmin, masters, selectedMasterId, selectedMasterName, loadMasters } = useAdminMasters();

const MASTER_CANCEL_REASONS = [
  'Болезнь',
  'Семейные обстоятельства',
  'Технические причины',
  'Другая причина',
];

const appointments = ref([]);
const loading = ref(true);
const error = ref(null);
const updatingId = ref(null);
const showPastAndClosed = ref(false);
const showCancelModal = ref(false);
const cancelTargetId = ref(null);
const cancelReason = ref('');
const cancelOtherText = ref('');

async function load() {
  if (isAdmin.value && masters.value.length && !selectedMasterId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    if (showPastAndClosed.value) params.set('upcomingOnly', 'false');
    else params.set('upcomingOnly', 'true');
    if (isAdmin.value && selectedMasterId.value) params.set('masterId', selectedMasterId.value);
    appointments.value = await api.get('/crm/appointments?' + params.toString());
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function masterDisplayName(m) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || m.id;
}

function selectMaster(m) {
  hapticFeedback?.('light');
  router.push({ path: '/admin/appointments', query: { masterId: m.id } });
}

function toggleShowPast() {
  showPastAndClosed.value = !showPastAndClosed.value;
  load();
}

async function setStatus(id, status, cancellationReason) {
  updatingId.value = id;
  error.value = null;
  try {
    const payload = { status };
    if (status === 'cancelled') {
      payload.cancellationReason = cancellationReason || 'Не указана';
    }
    await api.put(`/crm/appointments/${id}`, payload);
    hapticFeedback?.('light');
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    updatingId.value = null;
  }
}

function openCancelModal(id) {
  hapticFeedback?.('light');
  cancelTargetId.value = id;
  cancelReason.value = '';
  cancelOtherText.value = '';
  showCancelModal.value = true;
}

function closeCancelModal() {
  showCancelModal.value = false;
  cancelTargetId.value = null;
  cancelReason.value = '';
  cancelOtherText.value = '';
}

function masterReasonToSend() {
  if (cancelReason.value === 'Другая причина' && cancelOtherText.value.trim()) {
    return cancelOtherText.value.trim();
  }
  return cancelReason.value || 'Не указана';
}

function canConfirmMasterCancel() {
  if (!cancelReason.value) return false;
  if (cancelReason.value === 'Другая причина') return !!cancelOtherText.value.trim();
  return true;
}

async function confirmMasterCancel() {
  const id = cancelTargetId.value;
  if (!id) return;
  const reason = masterReasonToSend();
  closeCancelModal();
  await setStatus(id, 'cancelled', reason);
}

function goToDetail(id) {
  hapticFeedback?.('light');
  const query = { ...(showPastAndClosed.value ? { showAll: '1' } : {}), ...(isAdmin.value && selectedMasterId.value ? { masterId: selectedMasterId.value } : {}) };
  router.push({ name: 'AdminAppointmentDetail', params: { id }, query: Object.keys(query).length ? query : undefined });
}

function goBack() {
  hapticFeedback?.('light');
  if (isAdmin.value && selectedMasterId.value) {
    router.push('/admin/appointments');
    return;
  }
  router.push('/');
}

onMounted(async () => {
  showPastAndClosed.value = route.query.showAll === '1';
  if (isAdmin.value) await loadMasters();
  await load();
});

watch(() => route.query.showAll, (val) => {
  showPastAndClosed.value = val === '1';
  load();
}, { immediate: false });
watch(selectedMasterId, load);
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
      <h1 class="text-2xl font-bold">
        {{ isAdmin && selectedMasterId ? `Записи — ${selectedMasterName || 'Мастер'}` : 'Записи' }}
      </h1>
    </div>

    <template v-if="isAdmin && !selectedMasterId">
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">Выберите мастера, чтобы увидеть его записи</p>
      <ul class="space-y-3 mb-6">
        <li
          v-for="m in masters"
          :key="m.id"
          class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] active:opacity-90 cursor-pointer"
          @click="selectMaster(m)"
        >
          <div class="font-medium">{{ masterDisplayName(m) }}</div>
        </li>
      </ul>
    </template>

    <template v-else>
    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>

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
        :class="!a.serviceId ? 'bg-neutral-700/50 border border-neutral-600' : 'bg-[var(--tg-theme-secondary-bg-color)]'"
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
            class="text-sm px-2 py-0.5 rounded bg-neutral-600 text-white"
          >Для моделей</span>
          <span
            v-if="a.withDiscount"
            class="text-sm px-2 py-0.5 rounded bg-neutral-500 text-white"
          >Со скидкой</span>
          <span
            class="text-sm capitalize px-2 py-0.5 rounded"
            :class="a.status === 'cancelled' ? 'bg-neutral-800 text-neutral-300' : a.status === 'done' ? 'bg-neutral-500 text-white' : 'bg-[var(--tg-theme-section-bg-color)]'"
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
              class="text-sm px-2 py-1 rounded bg-neutral-500 text-white disabled:opacity-50"
              :disabled="updatingId === a.id"
              @click.stop="setStatus(a.id, 'done')"
            >
              Завершено
            </button>
            <button
              type="button"
              class="text-sm px-2 py-1 rounded bg-neutral-800 text-neutral-300 disabled:opacity-50"
              :disabled="updatingId === a.id"
              @click.stop="openCancelModal(a.id)"
            >
              Отменить
            </button>
          </template>
        </div>
      </li>
    </ul>

    <div
      v-if="showCancelModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      @click.self="closeCancelModal"
    >
      <div class="w-full max-w-sm rounded-xl p-4 bg-[var(--tg-theme-bg-color,#fff)] shadow-lg">
        <h3 class="text-lg font-semibold mb-3">Укажите причину отмены</h3>
        <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">Причина будет отправлена клиенту.</p>
        <div class="space-y-2 mb-4">
          <label
            v-for="r in MASTER_CANCEL_REASONS"
            :key="r"
            class="flex items-center gap-2 cursor-pointer"
          >
            <input v-model="cancelReason" type="radio" :value="r" class="rounded-full">
            <span class="text-sm">{{ r }}</span>
          </label>
          <div v-if="cancelReason === 'Другая причина'" class="ml-6 mt-2">
            <input
              v-model="cancelOtherText"
              type="text"
              placeholder="Напишите причину"
              class="w-full px-3 py-2 rounded-lg border border-[var(--tg-theme-hint-color,#999)] bg-[var(--tg-theme-bg-color,#fff)] text-sm"
            >
          </div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="flex-1 py-2 rounded-lg bg-neutral-800 text-white disabled:opacity-50"
            :disabled="updatingId !== null || !canConfirmMasterCancel()"
            @click="confirmMasterCancel"
          >
            {{ updatingId !== null ? 'Отмена…' : 'Отменить запись' }}
          </button>
          <button
            type="button"
            class="py-2 px-4 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e4e4e7)] text-sm"
            @click="closeCancelModal"
          >
            Назад
          </button>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>
