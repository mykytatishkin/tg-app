<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const route = useRoute();
const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const profile = ref(null);
const loading = ref(true);
const error = ref(null);

const masterId = route.params.id;

async function load() {
  loading.value = true;
  error.value = null;
  try {
    profile.value = await api.get(`/appointments/masters/${masterId}/profile`);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

const masterName = computed(() => {
  if (!profile.value) return '';
  return [profile.value.firstName, profile.value.lastName].filter(Boolean).join(' ');
});

const starsDisplay = computed(() => {
  if (!profile.value?.averageRating) return null;
  const r = profile.value.averageRating;
  const full = Math.floor(r);
  const half = r - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function goBack() {
  hapticFeedback?.('light');
  router.back();
}
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
      <h1 class="text-xl font-bold">Профиль мастера</h1>
    </div>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>
    <p v-else-if="error" class="text-neutral-400">{{ error }}</p>

    <template v-else-if="profile">
      <div class="flex items-center gap-4 mb-6 p-4 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]">
        <img
          v-if="profile.photoUrl"
          :src="profile.photoUrl"
          :alt="masterName"
          class="w-16 h-16 rounded-full object-cover"
        >
        <div
          v-else
          class="w-16 h-16 rounded-full bg-[var(--tg-theme-button-color,#1a1a1a)] flex items-center justify-center text-2xl font-bold text-[var(--tg-theme-button-text-color,#fff)]"
        >
          {{ profile.firstName?.[0] ?? '?' }}
        </div>

        <div class="flex-1 min-w-0">
          <div class="font-semibold text-lg">{{ masterName }}</div>
          <div v-if="profile.address" class="text-sm text-[var(--tg-theme-hint-color,#999)] truncate">
            {{ profile.address }}
          </div>
          <div v-if="profile.averageRating" class="flex items-center gap-1 mt-1">
            <span class="text-yellow-400 text-lg tracking-tight">{{ starsDisplay }}</span>
            <span class="font-medium">{{ profile.averageRating }}</span>
            <span class="text-sm text-[var(--tg-theme-hint-color,#999)]">({{ profile.reviewCount }})</span>
          </div>
          <div v-else class="text-sm text-[var(--tg-theme-hint-color,#999)] mt-1">Отзывов пока нет</div>
        </div>
      </div>

      <template v-if="profile.reviews.length > 0">
        <h2 class="text-base font-semibold mb-3">Отзывы</h2>
        <ul class="space-y-3">
          <li
            v-for="(review, i) in profile.reviews"
            :key="i"
            class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]"
          >
            <div class="flex items-center justify-between mb-1">
              <span class="text-yellow-400 text-base">
                {{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}
              </span>
              <span class="text-xs text-[var(--tg-theme-hint-color,#999)]">{{ formatDate(review.createdAt) }}</span>
            </div>
            <div v-if="review.serviceName" class="text-xs text-[var(--tg-theme-hint-color,#999)] mb-1">
              {{ review.serviceName }}
            </div>
            <p v-if="review.comment" class="text-sm">{{ review.comment }}</p>
          </li>
        </ul>
      </template>
      <p v-else class="text-[var(--tg-theme-hint-color,#999)] text-sm">Отзывов пока нет.</p>
    </template>
  </div>
</template>
