<script setup>
import { ref } from 'vue';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const props = defineProps({
  appointmentId: { type: String, required: true },
  serviceName: { type: String, default: null },
});

const emit = defineEmits(['done', 'close']);

const { hapticFeedback } = useTelegramWebApp();

const rating = ref(0);
const comment = ref('');
const hoveredStar = ref(0);
const submitting = ref(false);
const error = ref(null);

function selectStar(n) {
  hapticFeedback?.('light');
  rating.value = n;
}

async function submit() {
  if (rating.value === 0) {
    error.value = 'Выберите оценку';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    await api.post(`/appointments/${props.appointmentId}/review`, {
      rating: rating.value,
      comment: comment.value.trim() || undefined,
    });
    hapticFeedback?.('medium');
    emit('done');
  } catch (e) {
    error.value = e.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-sm rounded-2xl p-5 bg-[var(--tg-theme-bg-color,#fff)] shadow-xl">
      <h3 class="text-lg font-semibold mb-1">Оставить отзыв</h3>
      <p v-if="serviceName" class="text-sm text-[var(--tg-theme-hint-color,#999)] mb-4">
        {{ serviceName }}
      </p>

      <div class="flex justify-center gap-2 mb-4">
        <button
          v-for="n in 5"
          :key="n"
          type="button"
          class="text-3xl transition-transform active:scale-90"
          :class="n <= (hoveredStar || rating) ? 'text-yellow-400' : 'text-[var(--tg-theme-hint-color,#ccc)]'"
          @mouseenter="hoveredStar = n"
          @mouseleave="hoveredStar = 0"
          @click="selectStar(n)"
        >
          ★
        </button>
      </div>

      <textarea
        v-model="comment"
        rows="3"
        maxlength="500"
        placeholder="Комментарий (необязательно)"
        class="w-full px-3 py-2 rounded-xl border border-[var(--tg-theme-hint-color,#ddd)] bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-sm resize-none mb-3 outline-none"
      />

      <p v-if="error" class="text-red-400 text-sm mb-3">{{ error }}</p>

      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 py-2.5 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-50"
          :disabled="submitting || rating === 0"
          @click="submit"
        >
          {{ submitting ? 'Отправка…' : 'Отправить' }}
        </button>
        <button
          type="button"
          class="py-2.5 px-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#e4e4e7)] text-sm"
          @click="emit('close')"
        >
          Отмена
        </button>
      </div>
    </div>
  </div>
</template>
