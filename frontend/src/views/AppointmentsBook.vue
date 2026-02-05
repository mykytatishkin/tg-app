<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const route = useRoute();
const { hapticFeedback } = useTelegramWebApp();

/** '' = не выбрано, 'slot' = услуга, 'models' = для моделей, 'customTime' = своё время за доплату */
const bookingMode = ref('');
const forModelsMode = ref(false);
const masters = ref([]);
const selectedMasterId = ref('');
const services = ref([]);
const selectedServiceId = ref('');
const slots = ref([]);
const selectedSlot = ref(null);
/** null = не выбрано, false = от мастера, true = по референсу */
const designByReference = ref(null);
const note = ref('');
const referenceImageUrl = ref('');
const loadingMasters = ref(true);
const loadingServices = ref(false);
const loadingSlots = ref(false);
/** Master id for which services were last loaded — avoid reload when switching Услуга ↔ Своё время */
const servicesLoadedForMasterId = ref('');
const submitting = ref(false);
const error = ref(null);

/** Custom time request (when bookingMode === 'customTime') */
const customTimeRequestedDate = ref('');
const customTimeRequestedTime = ref('10:00');
const customTimeNote = ref('');
const customTimeSuccess = ref(false);

const DAYS_AHEAD = 60;

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getFromTo() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + DAYS_AHEAD);
  return {
    from: toLocalDateStr(from),
    to: toLocalDateStr(to),
  };
}

function formatMasterName(m) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Мастер';
}

function formatSlotLabel(slot, forModels = false) {
  const d = new Date(slot.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', weekday: 'short' });
  const start = slot.startTime?.slice(0, 5) ?? '';
  const end = slot.endTime?.slice(0, 5) ?? '';
  let label = end ? `${dateStr}, ${start} – ${end}` : `${dateStr}, ${start}`;
  if (forModels && slot.serviceName) label += ` · ${slot.serviceName}`;
  const mod = slot.priceModifier != null && !Number.isNaN(Number(slot.priceModifier)) ? Number(slot.priceModifier) : null;
  if (mod !== null && mod !== 0) {
    label += mod < 0 ? ` · −${Math.abs(mod)} €` : ` · +${mod} €`;
  }
  return label;
}

async function loadMasters() {
  loadingMasters.value = true;
  error.value = null;
  try {
    masters.value = await api.get('/appointments/masters');
    if (masters.value.length === 1) {
      selectedMasterId.value = masters.value[0].id;
    } else if (masters.value.length > 1 && !selectedMasterId.value) {
      selectedMasterId.value = masters.value[0].id;
    }
  } catch (e) {
    error.value = e.message;
  } finally {
    loadingMasters.value = false;
  }
}

async function loadServices() {
  if (!selectedMasterId.value) {
    services.value = [];
    servicesLoadedForMasterId.value = '';
    return;
  }
  if (servicesLoadedForMasterId.value === selectedMasterId.value && services.value.length > 0) {
    return;
  }
  loadingServices.value = true;
  services.value = [];
  selectedServiceId.value = '';
  slots.value = [];
  selectedSlot.value = null;
  error.value = null;
  try {
    services.value = await api.get(
      `/appointments/services?masterId=${encodeURIComponent(selectedMasterId.value)}`
    );
    servicesLoadedForMasterId.value = selectedMasterId.value;
    if (services.value.length) selectedServiceId.value = services.value[0].id;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6fe093b8-22a7-43f9-b1c3-8380735d7087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppointmentsBook.vue:loadServices',message:'after load services',data:{servicesCount:services.value.length,selectedServiceIdAfter:selectedServiceId.value||null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  } catch (e) {
    error.value = e.message;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6fe093b8-22a7-43f9-b1c3-8380735d7087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppointmentsBook.vue:loadServices',message:'loadServices error',data:{err:String(e?.message)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  } finally {
    loadingServices.value = false;
  }
}

async function loadSlots() {
  if (!selectedMasterId.value) {
    slots.value = [];
    return;
  }
  if (!forModelsMode.value && !selectedServiceId.value) {
    slots.value = [];
    return;
  }
  // For forModels: no service selection needed, slots already have service from master
  loadingSlots.value = true;
  slots.value = [];
  selectedSlot.value = null;
  error.value = null;
  try {
    const { from, to } = getFromTo();
    const list = forModelsMode.value
      ? await api.get(
          `/appointments/available-slots?forModels=true&masterId=${encodeURIComponent(selectedMasterId.value)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        )
      : await api.get(
          `/appointments/available-slots?masterId=${encodeURIComponent(selectedMasterId.value)}&serviceId=${encodeURIComponent(selectedServiceId.value)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
    slots.value = list;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6fe093b8-22a7-43f9-b1c3-8380735d7087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppointmentsBook.vue:loadSlots',message:'loadSlots success',data:{slotsCount:Array.isArray(list)?list.length:0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
  } catch (e) {
    error.value = e.message;
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/6fe093b8-22a7-43f9-b1c3-8380735d7087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppointmentsBook.vue:loadSlots',message:'loadSlots error',data:{err:String(e?.message)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
  } finally {
    loadingSlots.value = false;
  }
}

function onMasterChange() {
  if (bookingMode.value === '') return;
  if (forModelsMode.value) {
    loadSlots();
  } else {
    loadServices();
  }
}

function onServiceChange() {
  if (bookingMode.value !== 'customTime') loadSlots();
}

function selectSlot(slot) {
  hapticFeedback?.('light');
  selectedSlot.value = slot;
}

async function submit() {
  if (!selectedMasterId.value || !selectedSlot.value) {
    error.value = forModelsMode.value ? 'Выберите мастера и время.' : 'Выберите мастера, услугу и время.';
    return;
  }
  if (!forModelsMode.value && !selectedServiceId.value) {
    error.value = 'Выберите услугу.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const payload = {
      masterId: selectedMasterId.value,
      date: selectedSlot.value.date,
      startTime: selectedSlot.value.startTime,
      slotId: selectedSlot.value.slotId,
      note: designByReference.value ? (note.value || undefined) : undefined,
      referenceImageUrl: designByReference.value ? (referenceImageUrl.value || undefined) : undefined,
    };
    // For forModels: service comes from slot (master's choice), client cannot change
    if (!forModelsMode.value && selectedServiceId.value) payload.serviceId = selectedServiceId.value;
    const appointment = await api.post('/appointments/book', payload);
    hapticFeedback?.('success');
    router.push({ name: 'BookingSuccess', query: { id: appointment.id } });
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/appointments');
}

function onBookingModeChange() {
  selectedSlot.value = null;
  slots.value = [];
  customTimeSuccess.value = false;
  if (bookingMode.value === 'models') {
    selectedServiceId.value = '';
    if (selectedMasterId.value) loadSlots();
  } else if (bookingMode.value === 'slot' || bookingMode.value === 'customTime') {
    if (bookingMode.value === 'slot') designByReference.value = null;
    if (selectedMasterId.value) loadServices();
  } else {
    selectedServiceId.value = '';
    services.value = [];
  }
}

function getCustomTimeMinDate() {
  return toLocalDateStr(new Date());
}

async function submitCustomTime() {
  if (!selectedMasterId.value || !selectedServiceId.value) {
    error.value = 'Выберите мастера и услугу.';
    return;
  }
  if (!customTimeRequestedDate.value) {
    error.value = 'Укажите дату.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    await api.post('/custom-time-requests', {
      masterId: selectedMasterId.value,
      serviceId: selectedServiceId.value,
      requestedDate: customTimeRequestedDate.value,
      requestedStartTime: customTimeRequestedTime.value || undefined,
      note: customTimeNote.value?.trim() || undefined,
    });
    hapticFeedback?.('success');
    customTimeSuccess.value = true;
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}

const preselectedDate = ref(route.query.date ? String(route.query.date).trim() : '');
const preselectedMasterId = ref(route.query.masterId ? String(route.query.masterId).trim() : '');

onMounted(async () => {
  await loadMasters();
  if (preselectedMasterId.value && masters.value.some((m) => m.id === preselectedMasterId.value)) {
    selectedMasterId.value = preselectedMasterId.value;
  }
  if (selectedMasterId.value && (bookingMode.value === 'slot' || bookingMode.value === 'customTime')) {
    await loadServices();
  }
});

watch(selectedMasterId, () => {
  if (!loadingMasters.value) onMasterChange();
});

watch(selectedServiceId, () => {
  if (selectedMasterId.value && bookingMode.value === 'slot') loadSlots();
});

watch(slots, (newSlots) => {
  if (preselectedDate.value && newSlots.length && !selectedSlot.value) {
    const slot = newSlots.find((s) => s.date === preselectedDate.value);
    if (slot) selectedSlot.value = slot;
  }
}, { deep: true });
</script>

<template>
  <div class="min-h-screen p-4 pb-24 bg-[var(--tg-theme-bg-color,#e8e8e8)] text-[var(--tg-theme-text-color,#e8e8e8)]">
    <div class="flex items-center gap-3 mb-6">
      <button
        class="p-2 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f0f0f0)]"
        @click="goBack"
      >
        ← Назад
      </button>
      <h1 class="text-2xl font-bold">Записаться</h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>

    <div v-if="loadingMasters" class="text-[var(--tg-theme-hint-color,#999)] mb-4">Загрузка…</div>

    <template v-else-if="!error && masters.length === 0">
      <p class="text-[var(--tg-theme-hint-color,#999)]">Нет доступных мастеров для записи.</p>
    </template>

    <template v-else>
      <div class="space-y-4 mb-6">
        <div class="space-y-2">
          <span class="block text-sm font-medium text-[var(--tg-theme-hint-color,#999)]">Тип записи</span>
          <p v-if="!bookingMode" class="text-sm font-bold text-white">Выберите тип записи</p>
          <div class="flex flex-col sm:flex-row rounded-xl overflow-hidden bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] p-0.5 gap-0.5 sm:gap-0">
            <button
              type="button"
              class="flex-1 py-2.5 px-2 text-sm font-medium rounded-lg transition-colors"
              :class="bookingMode === 'slot' ? '!bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]' : 'bg-[var(--tg-theme-button-color,#1a1a1a)]/90 text-[var(--tg-theme-button-text-color,#e8e8e8)]'"
              @click="bookingMode = 'slot'; forModelsMode = false; onBookingModeChange()"
            >
              Услуга
            </button>
            <button
              type="button"
              class="flex-1 py-2.5 px-2 text-sm font-medium rounded-lg transition-colors"
              :class="bookingMode === 'models' ? '!bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]' : 'bg-[var(--tg-theme-button-color,#1a1a1a)]/90 text-[var(--tg-theme-button-text-color,#e8e8e8)]'"
              @click="bookingMode = 'models'; forModelsMode = true; onBookingModeChange()"
            >
              Для моделей
            </button>
            <button
              type="button"
              class="flex-1 py-2.5 px-2 text-sm font-medium rounded-lg transition-colors"
              :class="bookingMode === 'customTime' ? '!bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]' : 'bg-[var(--tg-theme-button-color,#1a1a1a)]/90 text-[var(--tg-theme-button-text-color,#e8e8e8)]'"
              @click="bookingMode = 'customTime'; forModelsMode = false; onBookingModeChange()"
            >
              Своё время
            </button>
          </div>
        </div>

        <div>
          <label for="book-master" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Мастер</label>
          <select
            id="book-master"
            v-model="selectedMasterId"
            class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
            @change="onMasterChange"
          >
            <option v-for="m in masters" :key="m.id" :value="m.id">
              {{ formatMasterName(m) }}
            </option>
          </select>
        </div>

        <div v-if="(bookingMode === 'slot' || bookingMode === 'customTime') && selectedMasterId">
          <label for="book-service" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Услуга</label>
          <div v-if="loadingServices" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка услуг…</div>
          <select
            v-else
            id="book-service"
            v-model="selectedServiceId"
            class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
            @change="onServiceChange"
          >
            <option value="">Выберите услугу</option>
            <option v-for="s in services" :key="s.id" :value="s.id">
              {{ s.name }} · {{ s.durationMinutes }} min · {{ s.price != null ? s.price + '+ €' : '' }}
            </option>
          </select>
        </div>

        <!-- Custom time request: date, time, note, fee rule -->
        <template v-if="bookingMode === 'customTime' && selectedMasterId && selectedServiceId">
          <p class="text-sm text-[var(--tg-theme-hint-color,#999)]">
            Доплата: сегодня +15 €, завтра +10 €, позже от +5 €.
          </p>
          <div v-if="!customTimeSuccess">
            <label for="custom-date" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Дата</label>
            <input
              id="custom-date"
              v-model="customTimeRequestedDate"
              type="date"
              :min="getCustomTimeMinDate()"
              class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
            >
            <label for="custom-time" class="block text-sm font-medium mb-1 mt-2 text-[var(--tg-theme-hint-color,#999)]">Время</label>
            <input
              id="custom-time"
              v-model="customTimeRequestedTime"
              type="time"
              class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
            >
            <label for="custom-note" class="block text-sm font-medium mb-1 mt-2 text-[var(--tg-theme-hint-color,#999)]">Комментарий (необязательно)</label>
            <textarea
              id="custom-note"
              v-model="customTimeNote"
              rows="2"
              class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
              placeholder="Пожелания к времени или услуге"
            />
          </div>
          <p v-else class="text-[var(--tg-theme-text-color,#e8e8e8)] font-medium">
            Запрос отправлен. Мастер подтвердит время и доплату; мы пришлём уведомление.
          </p>
        </template>

        <div v-if="forModelsMode && selectedMasterId" class="mb-2">
          <p v-if="!selectedSlot" class="text-sm text-[var(--tg-theme-hint-color,#999)]">
            Выберите время — услуга указана мастером в слоте.
          </p>
          <p v-else-if="selectedSlot?.serviceName" class="text-sm font-medium text-[var(--tg-theme-text-color,#e8e8e8)]">
            Услуга: {{ selectedSlot.serviceName }}
          </p>
        </div>
        <div v-if="!forModelsMode && selectedServiceId && bookingMode !== 'customTime'" class="space-y-1">
          <span class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">
            Свободное время
          </span>
        </div>
        <div v-if="bookingMode !== 'customTime' && (forModelsMode ? selectedMasterId : selectedServiceId)">
          <span v-if="forModelsMode" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Свободное время (для моделей)</span>
          <div v-if="loadingSlots" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка слотов…</div>
          <div v-else-if="slots.length === 0" class="text-[var(--tg-theme-hint-color,#999)]">
            Нет свободных слотов на ближайшие {{ DAYS_AHEAD }} дней. Попробуйте позже.
          </div>
          <ul v-else class="space-y-2 max-h-64 overflow-y-auto">
            <li
              v-for="(slot, idx) in slots"
              :key="`${slot.date}-${slot.startTime}-${slot.slotId || idx}`"
            >
              <button
                type="button"
                class="w-full text-left px-4 py-3 rounded-xl text-sm transition-colors"
                :class="selectedSlot && selectedSlot.slotId === slot.slotId && selectedSlot.date === slot.date && selectedSlot.startTime === slot.startTime
                  ? 'bg-white/10 border-2 border-[var(--tg-theme-button-text-color,#e8e8e8)] text-[var(--tg-theme-button-text-color,#e8e8e8)]'
                  : forModelsMode
                    ? 'bg-neutral-700/50 border border-neutral-600'
                    : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]'"
                @click="selectSlot(slot)"
              >
                {{ formatSlotLabel(slot, forModelsMode) }}
              </button>
            </li>
          </ul>
        </div>

        <div v-if="bookingMode === 'slot'" class="space-y-2">
          <span class="block text-sm font-medium text-[var(--tg-theme-hint-color,#999)]">Дизайн</span>
          <p v-if="designByReference === null" class="text-sm font-bold text-white">Выберите вариант</p>
          <div class="flex rounded-xl overflow-hidden bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)] p-0.5">
            <button
              type="button"
              class="flex-1 py-2.5 px-3 text-sm font-medium rounded-lg transition-colors"
              :class="designByReference === false ? '!bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]' : 'bg-[var(--tg-theme-button-color,#1a1a1a)]/90 text-[var(--tg-theme-button-text-color,#e8e8e8)]'"
              @click="designByReference = false"
            >
              Дизайн от мастера
            </button>
            <button
              type="button"
              class="flex-1 py-2.5 px-3 text-sm font-medium rounded-lg transition-colors"
              :class="designByReference === true ? '!bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-text-color)]' : 'bg-[var(--tg-theme-button-color,#1a1a1a)]/90 text-[var(--tg-theme-button-text-color,#e8e8e8)]'"
              @click="designByReference = true"
            >
              Дизайн по референсу
            </button>
          </div>
        </div>

        <template v-if="!forModelsMode && designByReference">
          <div>
            <label for="book-note" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Пожелания</label>
            <textarea
              id="book-note"
              v-model="note"
              rows="3"
              class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
              placeholder="Опишите пожелания к дизайну"
            />
          </div>
          <div>
            <label for="book-ref" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Ссылка на референс (мудборд / дизайн)</label>
            <input
              id="book-ref"
              v-model="referenceImageUrl"
              type="url"
              class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
              placeholder="https://..."
            >
          </div>
        </template>
      </div>

      <button
        v-if="bookingMode !== 'customTime'"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-60"
        :disabled="!bookingMode || !selectedMasterId || (!forModelsMode && !selectedServiceId) || !selectedSlot || submitting || (bookingMode === 'slot' && designByReference === null)"
        @click="submit"
      >
        {{ submitting ? 'Записываю…' : 'Записаться' }}
      </button>
      <button
        v-else-if="bookingMode === 'customTime' && !customTimeSuccess"
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)] disabled:opacity-60"
        :disabled="!selectedMasterId || !selectedServiceId || !customTimeRequestedDate || submitting"
        @click="submitCustomTime"
      >
        {{ submitting ? 'Отправляю…' : 'Отправить запрос' }}
      </button>
    </template>
  </div>
</template>
