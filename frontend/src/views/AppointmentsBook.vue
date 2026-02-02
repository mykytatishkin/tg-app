<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const masters = ref([]);
const selectedMasterId = ref('');
const services = ref([]);
const selectedServiceId = ref('');
const slots = ref([]);
const selectedSlot = ref(null);
const note = ref('');
const referenceImageUrl = ref('');
const loadingMasters = ref(true);
const loadingServices = ref(false);
const loadingSlots = ref(false);
const submitting = ref(false);
const error = ref(null);

const DAYS_AHEAD = 14;

function getFromTo() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + DAYS_AHEAD);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatMasterName(m) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Мастер';
}

function formatSlotLabel(slot) {
  const d = new Date(slot.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', weekday: 'short' });
  return `${dateStr}, ${slot.startTime.slice(0, 5)}`;
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
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6fe093b8-22a7-43f9-b1c3-8380735d7087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppointmentsBook.vue:loadSlots',message:'loadSlots entry',data:{masterId:selectedMasterId.value,serviceId:selectedServiceId.value},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  if (!selectedMasterId.value || !selectedServiceId.value) {
    slots.value = [];
    return;
  }
  loadingSlots.value = true;
  slots.value = [];
  selectedSlot.value = null;
  error.value = null;
  try {
    const { from, to } = getFromTo();
    const list = await api.get(
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
  loadServices();
}

function onServiceChange() {
  loadSlots();
}

function selectSlot(slot) {
  hapticFeedback?.('light');
  selectedSlot.value = slot;
}

async function submit() {
  if (!selectedMasterId.value || !selectedServiceId.value || !selectedSlot.value) {
    error.value = 'Select master, service and time slot.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const appointment = await api.post('/appointments/book', {
      masterId: selectedMasterId.value,
      serviceId: selectedServiceId.value,
      date: selectedSlot.value.date,
      startTime: selectedSlot.value.startTime,
      slotId: selectedSlot.value.slotId,
      note: note.value || undefined,
      referenceImageUrl: referenceImageUrl.value || undefined,
    });
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

onMounted(async () => {
  await loadMasters();
  if (selectedMasterId.value) await loadServices();
});

watch(selectedMasterId, () => {
  if (!loadingMasters.value) loadServices();
});

watch(selectedServiceId, (newVal) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/6fe093b8-22a7-43f9-b1c3-8380735d7087',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppointmentsBook.vue:watch(selectedServiceId)',message:'watch fired',data:{newVal,hasMaster:!!selectedMasterId.value},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (selectedMasterId.value) loadSlots();
});
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
      <h1 class="text-2xl font-bold">Записаться</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>

    <div v-if="loadingMasters" class="text-[var(--tg-theme-hint-color,#999)] mb-4">Загрузка…</div>

    <template v-else-if="!error && masters.length === 0">
      <p class="text-[var(--tg-theme-hint-color,#999)]">Нет доступных мастеров для записи.</p>
    </template>

    <template v-else>
      <div class="space-y-4 mb-6">
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

        <div v-if="selectedMasterId">
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
              {{ s.name }} · {{ s.durationMinutes }} min · {{ s.price != null ? s.price + ' €' : '' }}
            </option>
          </select>
        </div>

        <div v-if="selectedServiceId">
          <label class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Свободное время</label>
          <div v-if="loadingSlots" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка слотов…</div>
          <div v-else-if="slots.length === 0" class="text-[var(--tg-theme-hint-color,#999)]">
            Нет свободных слотов на ближайшие {{ DAYS_AHEAD }} дней. Попробуйте другую услугу или зайдите позже.
          </div>
          <ul v-else class="space-y-2 max-h-64 overflow-y-auto">
            <li
              v-for="(slot, idx) in slots"
              :key="`${slot.date}-${slot.startTime}-${idx}`"
            >
              <button
                type="button"
                class="w-full text-left px-4 py-3 rounded-xl text-sm transition-colors"
                :class="selectedSlot && selectedSlot.date === slot.date && selectedSlot.startTime === slot.startTime
                  ? 'bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)]'
                  : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)]'"
                @click="selectSlot(slot)"
              >
                {{ formatSlotLabel(slot) }}
              </button>
            </li>
          </ul>
        </div>

        <div>
          <label for="book-note" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Пожелания (необязательно)</label>
          <textarea
            id="book-note"
            v-model="note"
            rows="2"
            class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
            placeholder="Пожелания для мастера"
          />
        </div>

        <div>
          <label for="book-ref" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Ссылка на фото (необязательно)</label>
          <input
            id="book-ref"
            v-model="referenceImageUrl"
            type="url"
            class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
            placeholder="https://..."
          >
        </div>
      </div>

      <button
        class="w-full py-3 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#3390ec)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-60"
        :disabled="!selectedMasterId || !selectedServiceId || !selectedSlot || submitting"
        @click="submit"
      >
        {{ submitting ? 'Записываю…' : 'Записаться' }}
      </button>
    </template>
  </div>
</template>
