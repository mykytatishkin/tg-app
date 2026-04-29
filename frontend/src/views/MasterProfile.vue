<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const route = useRoute();
const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const profile = ref(null);
const portfolio = ref([]);
const loading = ref(true);
const error = ref(null);
const bioExpanded = ref(false);
const activeTag = ref('');
const lightboxPhoto = ref(null);

const masterId = route.params.id;

async function load() {
  loading.value = true;
  error.value = null;
  try {
    [profile.value, portfolio.value] = await Promise.all([
      api.get(`/appointments/masters/${masterId}/profile`),
      api.get(`/appointments/masters/${masterId}/portfolio`).catch(() => []),
    ]);
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

const portfolioTags = computed(() => {
  const tags = new Set(portfolio.value.map((p) => p.tag).filter(Boolean));
  return ['', ...tags];
});

const filteredPortfolio = computed(() => {
  if (!activeTag.value) return portfolio.value;
  return portfolio.value.filter((p) => p.tag === activeTag.value);
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

function setTag(tag) {
  hapticFeedback?.('light');
  activeTag.value = tag;
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
      <h1 class="text-xl font-bold">Профиль мастера</h1>
    </div>

    <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>
    <p v-else-if="error" class="text-neutral-400">{{ error }}</p>

    <template v-else-if="profile">
      <!-- Master info card -->
      <div class="flex items-center gap-4 mb-4 p-4 rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]">
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

      <!-- Bio: collapsed after 3 lines with "Читать далее" -->
      <div v-if="profile.bio" class="mb-6 p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)]">
        <p
          class="text-sm leading-relaxed whitespace-pre-line"
          :class="bioExpanded ? '' : 'line-clamp-3'"
        >
          {{ profile.bio }}
        </p>
        <button
          v-if="!bioExpanded"
          type="button"
          class="mt-2 text-sm text-[var(--tg-theme-link-color,#2481cc)]"
          @click="bioExpanded = true; hapticFeedback?.('light')"
        >
          Читать далее
        </button>
      </div>

      <!-- Portfolio -->
      <template v-if="portfolio.length > 0">
        <h2 class="text-base font-semibold mb-3">Портфолио</h2>

        <!-- Tag filter pills -->
        <div v-if="portfolioTags.length > 1" class="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
          <button
            v-for="tag in portfolioTags"
            :key="tag"
            type="button"
            :class="[
              'shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-colors',
              activeTag === tag
                ? 'bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#fff)]'
                : 'bg-[var(--tg-theme-secondary-bg-color,#f5f5f5)] text-[var(--tg-theme-text-color)]'
            ]"
            @click="setTag(tag)"
          >
            {{ tag || 'Все' }}
          </button>
        </div>

        <!-- Photo grid -->
        <div class="grid grid-cols-2 gap-2 mb-6">
          <button
            v-for="photo in filteredPortfolio"
            :key="photo.id"
            type="button"
            class="relative rounded-xl overflow-hidden bg-[var(--tg-theme-secondary-bg-color)] focus:outline-none"
            @click="lightboxPhoto = photo; hapticFeedback?.('light')"
          >
            <img
              :src="photo.url"
              :alt="photo.tag || 'Портфолио'"
              class="w-full aspect-square object-cover"
            />
            <div v-if="photo.tag" class="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-xs truncate">
              {{ photo.tag }}
            </div>
          </button>
        </div>
      </template>

      <!-- Reviews -->
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
      <p v-else-if="portfolio.length === 0" class="text-[var(--tg-theme-hint-color,#999)] text-sm">Отзывов пока нет.</p>
    </template>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxPhoto"
        class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        @click="lightboxPhoto = null"
      >
        <img
          :src="lightboxPhoto.url"
          :alt="lightboxPhoto.tag || 'Портфолио'"
          class="max-w-full max-h-full rounded-xl object-contain"
          @click.stop
        />
        <button
          type="button"
          class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 text-white text-xl flex items-center justify-center"
          @click="lightboxPhoto = null"
        >×</button>
        <div v-if="lightboxPhoto.tag" class="absolute bottom-6 left-0 right-0 text-center text-white text-sm">
          {{ lightboxPhoto.tag }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
