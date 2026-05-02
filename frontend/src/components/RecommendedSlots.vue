<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const props = defineProps({
  masterId: { type: String, default: '' },
});

const emit = defineEmits(['select']);

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const slots = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const url = props.masterId
      ? `/appointments/recommendations?masterId=${encodeURIComponent(props.masterId)}`
      : '/appointments/recommendations';
    slots.value = await api.get(url);
  } catch {
    slots.value = [];
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(t) {
  return t?.slice(0, 5) ?? '';
}

function formatPrice(slot) {
  const base = slot.servicePrice != null ? Number(slot.servicePrice) : null;
  const mod = slot.priceModifier != null ? Number(slot.priceModifier) : 0;
  if (base == null) return '';
  const total = base + mod;
  return total.toFixed(0) + ' €';
}

function pick(slot) {
  hapticFeedback?.('light');
  emit('select', slot);
}

onMounted(load);
</script>

<template>
  <div v-if="!loading && slots.length > 0" class="mb-6">
    <h2 class="text-sm font-semibold text-[var(--tg-theme-hint-color,#999)] uppercase tracking-wide mb-3">
      Рекомендуем
    </h2>
    <div class="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      <button
        v-for="slot in slots"
        :key="slot.slotId"
        type="button"
        class="shrink-0 w-40 rounded-xl p-3 bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-left transition-opacity active:opacity-70"
        @click="pick(slot)"
      >
        <div class="text-xs text-[var(--tg-theme-hint-color,#999)] mb-1">{{ slot.masterName }}</div>
        <div class="text-sm font-semibold mb-0.5">{{ formatDate(slot.date) }}</div>
        <div class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-1">{{ formatTime(slot.startTime) }}</div>
        <div v-if="slot.serviceName" class="text-xs truncate mb-1">{{ slot.serviceName }}</div>
        <div v-if="formatPrice(slot)" class="text-xs font-medium text-[var(--tg-theme-button-color,#1a1a1a)]">
          {{ formatPrice(slot) }}
        </div>
      </button>
    </div>
  </div>
</template>
