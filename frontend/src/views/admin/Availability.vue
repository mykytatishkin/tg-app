<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';

const DEFAULT_DURATION_HOURS = 2;

function addHoursToTime(timeStr, hours) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m + hours * 60;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:00`;
}

function getDefaultEndTime(startTime) {
  return addHoursToTime(startTime, DEFAULT_DURATION_HOURS);
}

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const slots = ref([]);
const loading = ref(true);
const error = ref(null);
const showForm = ref(false);
const form = ref({ date: '', startTime: '09:00', endTime: '11:00', priceModifier: '', forModels: false });
const submitting = ref(false);
const deletingId = ref(null);
const lastAdded = ref(null);

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

function openFormWithSameDate() {
  if (!lastAdded.value) return;
  hapticFeedback?.('light');
  const nextStart = lastAdded.value.endTime;
  form.value = {
    date: lastAdded.value.date,
    startTime: nextStart.slice(0, 5),
    endTime: getDefaultEndTime(nextStart).slice(0, 5),
    priceModifier: '',
    forModels: false,
  };
  showForm.value = true;
  lastAdded.value = null;
}

function openNewForm() {
  const today = new Date().toISOString().slice(0, 10);
  form.value = { date: today, startTime: '09:00', endTime: getDefaultEndTime('09:00').slice(0, 5), priceModifier: '', forModels: false };
  showForm.value = true;
  lastAdded.value = null;
}

function onFormStartTimeChange() {
  form.value.endTime = getDefaultEndTime(form.value.startTime).slice(0, 5);
}

async function addSlot() {
  if (!form.value.date || !form.value.startTime || !form.value.endTime) {
    error.value = 'Укажите дату, начало и конец.';
    return;
  }
  const startTime = form.value.startTime.length === 5 ? form.value.startTime + ':00' : form.value.startTime;
  const endTime = form.value.endTime.length === 5 ? form.value.endTime + ':00' : form.value.endTime;
  submitting.value = true;
  error.value = null;
  const priceModifierRaw = form.value.priceModifier?.trim();
  const priceModifier = priceModifierRaw === '' || priceModifierRaw == null ? undefined : Number(priceModifierRaw);
  try {
    await api.post('/crm/availability', {
      date: form.value.date,
      startTime,
      endTime,
      isAvailable: true,
      ...(priceModifier != null && !Number.isNaN(priceModifier) ? { priceModifier } : {}),
      forModels: !!form.value.forModels,
    });
    hapticFeedback?.('light');
    lastAdded.value = { date: form.value.date, endTime };
    showForm.value = false;
    form.value = { date: '', startTime: '09:00', endTime: '11:00', priceModifier: '', forModels: false };
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
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color,#000)]">
    <div class="flex items-center gap-3 mb-6">
      <button
        class="p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f0f0f0)]"
        @click="goBack"
      >
        ← Назад
      </button>
      <h1 class="text-2xl font-bold">Доступность</h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>

    <div v-if="!showForm" class="mb-6 space-y-3">
      <button
        type="button"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
        @click="openNewForm"
      >
        Добавить слот
      </button>
      <button
        v-if="lastAdded"
        type="button"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-secondary-bg-color,#e5e5e5)] text-[var(--tg-theme-text-color,#000)]"
        @click="openFormWithSameDate"
      >
        Продолжить с той же датой
      </button>
    </div>

    <div v-else class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] space-y-3">
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)]">Интервал по умолчанию: {{ DEFAULT_DURATION_HOURS }} ч</p>
      <input
        v-model="form.date"
        type="date"
        class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
      >
      <div class="flex gap-2">
        <input
          v-model="form.startTime"
          type="time"
          class="flex-1 p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
          @change="onFormStartTimeChange"
        >
        <input
          v-model="form.endTime"
          type="time"
          class="flex-1 p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
      </div>
      <div>
        <label for="slot-price-modifier" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Скидка / Доплата (€)</label>
        <input
          id="slot-price-modifier"
          v-model="form.priceModifier"
          type="number"
          step="0.01"
          placeholder="−5 скидка, +10 доплата"
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
        <p class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-1">Минус — скидка, плюс — доплата. Пусто — без изменения цены.</p>
      </div>
      <label class="flex items-center gap-2 cursor-pointer">
        <input v-model="form.forModels" type="checkbox" class="rounded">
        <span class="text-sm">Для моделей</span>
      </label>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-60"
          :disabled="submitting"
          @click="addSlot"
        >
          {{ submitting ? 'Добавляю…' : 'Добавить' }}
        </button>
        <button
          type="button"
          class="py-2 px-4 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e5e5e5)]"
          @click="showForm = false"
        >
          Отмена
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>

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
            <span v-if="s.forModels" class="text-neutral-400 font-medium">Для моделей</span>
            <span v-if="s.priceModifier != null && Number(s.priceModifier) !== 0" :class="Number(s.priceModifier) < 0 ? 'text-neutral-400' : 'text-neutral-500'">
              {{ Number(s.priceModifier) > 0 ? '+' : '' }}{{ s.priceModifier }} €
            </span>
            <span v-if="!s.isAvailable" class="text-neutral-500"> (unavailable)</span>
          </div>
        </div>
        <button
          type="button"
          class="text-sm px-2 py-1 rounded bg-neutral-800 text-neutral-300 disabled:opacity-50"
          :disabled="deletingId === s.id"
          @click="removeSlot(s.id)"
        >
          Удалить
        </button>
      </li>
    </ul>
  </div>
</template>
