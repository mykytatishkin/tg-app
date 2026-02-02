<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const services = ref([]);
const selectedServiceId = ref('');
const slots = ref([]);
const selectedSlot = ref(null);
const note = ref('');
const referenceImageUrl = ref('');
const loadingServices = ref(true);
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

function formatSlotLabel(slot) {
  const d = new Date(slot.date + 'T12:00:00');
  const dateStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', weekday: 'short' });
  return `${dateStr}, ${slot.startTime.slice(0, 5)}`;
}

async function loadServices() {
  loadingServices.value = true;
  error.value = null;
  try {
    services.value = await api.get('/appointments/services');
    if (services.value.length) selectedServiceId.value = services.value[0].id;
  } catch (e) {
    error.value = e.message;
  } finally {
    loadingServices.value = false;
  }
}

async function loadSlots() {
  if (!selectedServiceId.value) {
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
      `/appointments/available-slots?serviceId=${encodeURIComponent(selectedServiceId.value)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );
    slots.value = list;
  } catch (e) {
    error.value = e.message;
  } finally {
    loadingSlots.value = false;
  }
}

function onServiceChange() {
  loadSlots();
}

function selectSlot(slot) {
  hapticFeedback?.('light');
  selectedSlot.value = slot;
}

async function submit() {
  if (!selectedServiceId.value || !selectedSlot.value) {
    error.value = 'Оберіть послугу та зручний час.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    await api.post('/appointments/book', {
      serviceId: selectedServiceId.value,
      date: selectedSlot.value.date,
      startTime: selectedSlot.value.startTime,
      slotId: selectedSlot.value.slotId,
      note: note.value || undefined,
      referenceImageUrl: referenceImageUrl.value || undefined,
    });
    hapticFeedback?.('success');
    router.push('/appointments');
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

onMounted(() => {
  loadServices();
});

watch(selectedServiceId, () => {
  loadSlots();
});
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
      <h1 class="text-2xl font-bold">Записатися</h1>
    </div>

    <p v-if="error" class="text-red-500 mb-4">{{ error }}</p>

    <div v-if="loadingServices" class="text-[var(--tg-theme-hint-color,#999)] mb-4">Завантаження послуг…</div>

    <template v-else>
      <div class="space-y-4 mb-6">
        <div>
          <label for="book-service" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Послуга</label>
          <select
            id="book-service"
            v-model="selectedServiceId"
            class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
            @change="onServiceChange"
          >
            <option v-for="s in services" :key="s.id" :value="s.id">
              {{ s.name }} · {{ s.durationMinutes }} хв · {{ s.price }}
            </option>
          </select>
        </div>

        <div v-if="selectedServiceId">
          <label class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Доступний час майстра</label>
          <div v-if="loadingSlots" class="text-[var(--tg-theme-hint-color,#999)]">Завантаження слотів…</div>
          <div v-else-if="slots.length === 0" class="text-[var(--tg-theme-hint-color,#999)]">
            На найближчі {{ DAYS_AHEAD }} днів вільних слотів немає. Спробуйте іншу послугу або зайдіть пізніше.
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
          <label for="book-note" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Примітка (необовʼязково)</label>
          <textarea
            id="book-note"
            v-model="note"
            rows="2"
            class="w-full p-3 rounded-lg bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] border border-[var(--tg-theme-section-separator-color,#e5e5e5)]"
            placeholder="Побажання для майстра"
          />
        </div>

        <div>
          <label for="book-ref" class="block text-sm font-medium mb-1 text-[var(--tg-theme-hint-color,#999)]">Посилання на фото (необовʼязково)</label>
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
        :disabled="!selectedSlot || submitting"
        @click="submit"
      >
        {{ submitting ? 'Записую…' : 'Записатися' }}
      </button>
    </template>
  </div>
</template>
