<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../../api/client';
import { useTelegramWebApp } from '../../composables/useTelegramWebApp';
import { useAdminMasters } from '../../composables/useAdminMasters';

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
const { isAdmin, masters, selectedMasterId, selectedMasterName, loadMasters } = useAdminMasters();

const slots = ref([]);
const loading = ref(true);
const error = ref(null);
const showForm = ref(false);
const form = ref({ date: '', startTime: '09:00', endTime: '11:00', priceModifier: '', forModels: false, serviceId: '' });
const modelServices = ref([]);
const submitting = ref(false);
const deletingId = ref(null);
const lastAdded = ref(null);
const editingSlotId = ref(null);

async function load() {
  if (isAdmin.value && masters.value.length && !selectedMasterId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const qs = isAdmin.value && selectedMasterId.value ? `?masterId=${encodeURIComponent(selectedMasterId.value)}` : '';
    slots.value = await api.get('/crm/availability' + qs);
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
  router.push({ path: '/admin/availability', query: { masterId: m.id } });
}

function openFormWithSameDate() {
  if (!lastAdded.value) return;
  hapticFeedback?.('light');
  editingSlotId.value = null;
  const nextStart = lastAdded.value.endTime;
  form.value = {
    date: lastAdded.value.date,
    startTime: nextStart.slice(0, 5),
    endTime: getDefaultEndTime(nextStart).slice(0, 5),
    priceModifier: '',
    forModels: false,
    serviceId: '',
  };
  showForm.value = true;
  lastAdded.value = null;
  if (form.value.forModels) loadModelServices();
}

function openNewForm() {
  const today = new Date().toISOString().slice(0, 10);
  form.value = { date: today, startTime: '09:00', endTime: getDefaultEndTime('09:00').slice(0, 5), priceModifier: '', forModels: false, serviceId: '' };
  editingSlotId.value = null;
  showForm.value = true;
  lastAdded.value = null;
  if (form.value.forModels) loadModelServices();
}

function openEditForm(slot) {
  hapticFeedback?.('light');
  const start = (slot.startTime || '').slice(0, 5);
  const end = (slot.endTime || '').slice(0, 5);
  form.value = {
    date: slot.date,
    startTime: start,
    endTime: end,
    priceModifier: slot.priceModifier != null ? String(slot.priceModifier) : '',
    forModels: !!slot.forModels,
    serviceId: slot.serviceId || slot.service?.id || '',
  };
  editingSlotId.value = slot.id;
  showForm.value = true;
  lastAdded.value = null;
  if (form.value.forModels) loadModelServices();
}

function onFormStartTimeChange() {
  form.value.endTime = getDefaultEndTime(form.value.startTime).slice(0, 5);
}

async function loadModelServices() {
  try {
    const qs = isAdmin.value && selectedMasterId.value ? `?masterId=${encodeURIComponent(selectedMasterId.value)}` : '';
    const all = await api.get('/crm/services' + qs);
    modelServices.value = (all || []).filter((s) => s.forModels);
  } catch {
    modelServices.value = [];
  }
}

function buildSlotPayload() {
  const startTime = form.value.startTime.length === 5 ? form.value.startTime + ':00' : form.value.startTime;
  const endTime = form.value.endTime.length === 5 ? form.value.endTime + ':00' : form.value.endTime;
  const priceModifierRaw = String(form.value.priceModifier ?? '').trim();
  const priceModifier = priceModifierRaw === '' ? undefined : Number(priceModifierRaw);
  return {
    date: form.value.date,
    startTime,
    endTime,
    isAvailable: true,
    ...(priceModifier != null && !Number.isNaN(priceModifier) ? { priceModifier } : {}),
    forModels: !!form.value.forModels,
    ...(form.value.forModels && form.value.serviceId ? { serviceId: form.value.serviceId } : {}),
  };
}

async function addSlot() {
  if (!form.value.date || !form.value.startTime || !form.value.endTime) {
    error.value = 'Укажите дату, начало и конец.';
    return;
  }
  if (form.value.forModels && !form.value.serviceId) {
    error.value = 'Для слота «для моделей» выберите услугу.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    await api.post('/crm/availability', buildSlotPayload());
    hapticFeedback?.('light');
    lastAdded.value = { date: form.value.date, endTime: form.value.endTime.length === 5 ? form.value.endTime + ':00' : form.value.endTime };
    showForm.value = false;
    form.value = { date: '', startTime: '09:00', endTime: '11:00', priceModifier: '', forModels: false, serviceId: '' };
    editingSlotId.value = null;
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}

async function saveSlot() {
  if (!editingSlotId.value) return;
  if (!form.value.date || !form.value.startTime || !form.value.endTime) {
    error.value = 'Укажите дату, начало и конец.';
    return;
  }
  if (form.value.forModels && !form.value.serviceId) {
    error.value = 'Для слота «для моделей» выберите услугу.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    await api.put(`/crm/availability/${editingSlotId.value}`, buildSlotPayload());
    hapticFeedback?.('light');
    showForm.value = false;
    form.value = { date: '', startTime: '09:00', endTime: '11:00', priceModifier: '', forModels: false, serviceId: '' };
    editingSlotId.value = null;
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
  if (isAdmin.value && selectedMasterId.value) {
    router.push('/admin/availability');
    return;
  }
  router.push('/');
}

onMounted(async () => {
  if (isAdmin.value) await loadMasters();
  await load();
});
watch(selectedMasterId, load);
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
      <h1 class="text-2xl font-bold">
        {{ isAdmin && selectedMasterId ? `Окошки — ${selectedMasterName || 'Мастер'}` : 'Окошки' }}
      </h1>
    </div>

    <template v-if="isAdmin && !selectedMasterId">
      <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-3">Выберите мастера, чтобы увидеть его слоты</p>
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
    <p class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-4">
      Клиенты видят слоты на ближайшие 60 дней — добавляйте слоты в этом диапазоне.
    </p>

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
      <p v-if="!editingSlotId" class="text-sm text-[var(--tg-theme-hint-color,#999)]">Интервал по умолчанию: {{ DEFAULT_DURATION_HOURS }} ч</p>
      <p v-else class="text-sm font-medium text-[var(--tg-theme-text-color,#000)]">Редактировать слот</p>
      <input
        v-model="form.date"
        type="date"
        :min="new Date().toISOString().slice(0, 10)"
        :max="(() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })()"
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
        <input v-model="form.forModels" type="checkbox" class="rounded" @change="form.forModels ? loadModelServices() : (form.serviceId = '')">
        <span class="text-sm">Для моделей</span>
      </label>
      <div v-if="form.forModels">
        <label for="slot-service" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Услуга (клиент её не меняет)</label>
        <select
          id="slot-service"
          v-model="form.serviceId"
          required
          class="w-full p-3 rounded-lg bg-[var(--tg-theme-bg-color,#e8e8e8)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
        >
          <option value="">Выберите услугу</option>
          <option v-for="s in modelServices" :key="s.id" :value="s.id">
            {{ s.name }} · {{ s.durationMinutes }} min
          </option>
        </select>
        <p v-if="modelServices.length === 0" class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-1">Нет услуг для моделей. Создайте в «Услуги» и включите «Для моделей».</p>
      </div>
      <div class="flex gap-2">
        <button
          v-if="editingSlotId"
          type="button"
          class="flex-1 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-60"
          :disabled="submitting || (form.forModels && !form.serviceId)"
          @click="saveSlot"
        >
          {{ submitting ? 'Сохраняю…' : 'Сохранить' }}
        </button>
        <button
          v-else
          type="button"
          class="flex-1 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-60"
          :disabled="submitting || (form.forModels && !form.serviceId)"
          @click="addSlot"
        >
          {{ submitting ? 'Добавляю…' : 'Добавить' }}
        </button>
        <button
          type="button"
          class="py-2 px-4 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#e5e5e5)]"
          @click="showForm = false; editingSlotId = null"
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
        class="p-4 rounded-xl flex flex-col gap-3 transition-opacity"
        :class="['bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]', { 'opacity-50': s.isBooked }]"
      >
        <div>
          <div class="font-medium">{{ s.date }}</div>
          <div class="text-sm text-[var(--tg-theme-hint-color,#999)]">
            {{ (s.startTime || '').slice(0, 5) }} – {{ (s.endTime || '').slice(0, 5) }}
            <span v-if="s.forModels" class="text-neutral-400 font-medium">Для моделей</span>
            <span v-if="s.priceModifier != null && Number(s.priceModifier) !== 0" :class="Number(s.priceModifier) < 0 ? 'text-neutral-400' : 'text-neutral-500'">
              {{ Number(s.priceModifier) > 0 ? '+' : '' }}{{ s.priceModifier }} €
            </span>
            <span v-if="s.isBooked" class="font-medium text-[var(--tg-theme-hint-color,#999)]"> — Занят</span>
            <span v-if="!s.isAvailable" class="text-neutral-500"> (unavailable)</span>
          </div>
          <div v-if="s.forModels && s.service" class="text-sm mt-1 text-[var(--tg-theme-text-color,#000)] font-medium">
            Процедура: {{ s.service.name }}
          </div>
        </div>
        <div class="flex items-center gap-2 pt-1 border-t border-[var(--tg-theme-section-separator-color,#e5e5e5)]">
          <button
            type="button"
            class="text-sm px-3 py-2 rounded-lg bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
            @click="openEditForm(s)"
          >
            Редактировать
          </button>
          <button
            type="button"
            class="text-sm px-3 py-2 rounded-lg bg-neutral-800 text-neutral-300 disabled:opacity-50"
            :disabled="deletingId === s.id"
            @click="removeSlot(s.id)"
          >
            Удалить
          </button>
        </div>
      </li>
    </ul>
    </template>
  </div>
</template>
