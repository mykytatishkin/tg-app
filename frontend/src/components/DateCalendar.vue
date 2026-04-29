<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  /** Array of slot objects: { date: 'YYYY-MM-DD', startTime, endTime, slotId, priceModifier? } */
  slots: { type: Array, required: true },
  /** Currently selected date string 'YYYY-MM-DD' or null */
  selectedDate: { type: String, default: null },
  forModels: { type: Boolean, default: false },
});

const emit = defineEmits(['select-date']);

const animatingDate = ref(null);

const availableDates = computed(() => new Set(props.slots.map((s) => s.date)));

/** Build list of calendar months covering all available dates. */
const months = computed(() => {
  const dates = [...availableDates.value].sort();
  if (!dates.length) return [];
  const first = new Date(dates[0] + 'T00:00:00');
  const last = new Date(dates[dates.length - 1] + 'T00:00:00');
  const result = [];
  const cur = new Date(first.getFullYear(), first.getMonth(), 1);
  while (cur <= last) {
    result.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
});

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const DAY_HEADERS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function calendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  // Monday-first: getDay() 0=Sun, adjust to Mon-first
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push(`${year}-${mm}-${dd}`);
  }
  return cells;
}

function selectDate(dateStr) {
  if (!availableDates.value.has(dateStr)) return;
  animatingDate.value = dateStr;
  emit('select-date', dateStr);
  setTimeout(() => { animatingDate.value = null; }, 300);
}
</script>

<template>
  <div class="space-y-4">
    <div class="text-sm text-center text-[var(--tg-theme-hint-color,#999)] mb-1">
      Выберите дату
    </div>

    <div v-for="{ year, month } in months" :key="`${year}-${month}`">
      <div class="text-sm font-semibold text-center mb-2">
        {{ MONTH_NAMES[month] }} {{ year }}
      </div>

      <!-- Day-of-week header -->
      <div class="grid grid-cols-7 mb-1">
        <div
          v-for="h in DAY_HEADERS"
          :key="h"
          class="text-center text-xs text-[var(--tg-theme-hint-color,#999)] py-1"
        >
          {{ h }}
        </div>
      </div>

      <!-- Date cells -->
      <div class="grid grid-cols-7 gap-1">
        <div
          v-for="(dateStr, idx) in calendarDays(year, month)"
          :key="idx"
        >
          <!-- Empty cell for offset -->
          <div v-if="!dateStr" class="w-full aspect-square" />

          <!-- Available date -->
          <button
            v-else-if="availableDates.has(dateStr)"
            type="button"
            class="w-full aspect-square rounded-xl text-sm font-medium flex items-center justify-center transition-colors calendar-cell"
            :class="[
              selectedDate === dateStr
                ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]'
                : 'bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] text-[var(--tg-theme-text-color,#000)]',
              animatingDate === dateStr ? 'date-confirm-anim' : '',
            ]"
            @click="selectDate(dateStr)"
          >
            {{ Number(dateStr.slice(8)) }}
          </button>

          <!-- Unavailable date -->
          <div
            v-else
            class="w-full aspect-square rounded-xl text-sm flex items-center justify-center text-[var(--tg-theme-hint-color,#ccc)] opacity-30 select-none"
          >
            {{ Number(dateStr.slice(8)) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes date-confirm {
  0%   { transform: scale(1);    opacity: 1; }
  40%  { transform: scale(1.18); opacity: 0.85; }
  70%  { transform: scale(0.96); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}

.date-confirm-anim {
  animation: date-confirm 280ms ease-out forwards;
}
</style>
