<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useTelegramWebApp } from '../composables/useTelegramWebApp';

const router = useRouter();
const { hapticFeedback } = useTelegramWebApp();

const giveaways = ref([]);
const loading = ref(true);
const error = ref(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    giveaways.value = await api.get('/giveaways');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function goBack() {
  hapticFeedback?.('light');
  router.push('/');
}

function goToGiveaway(id) {
  hapticFeedback?.('light');
  router.push(`/giveaways/${id}`);
}

function goToBook() {
  hapticFeedback?.('light');
  router.push('/appointments/book');
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
      <h1 class="text-2xl font-bold">Актуальные акции</h1>
    </div>

    <p v-if="error" class="text-neutral-400 mb-4">{{ error }}</p>

    <section class="mb-8">
      <h2 class="text-lg font-semibold mb-3">Скидки и предложения</h2>
      <div class="rounded-xl p-4 bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] mb-4">
        <p class="text-sm text-[var(--tg-theme-text-color,#000)] mb-3">
          Следите за акциями и спецпредложениями — здесь появляются скидки и бонусы для наших клиентов.
        </p>
        <button
          type="button"
          class="w-full py-2.5 px-4 rounded-xl font-medium bg-[var(--tg-theme-button-color,#1a1a1a)] text-[var(--tg-theme-button-text-color,#e8e8e8)]"
          @click="goToBook"
        >
          Записаться
        </button>
      </div>
    </section>

    <section>
      <h2 class="text-lg font-semibold mb-3">Конкурсы и розыгрыши</h2>
      <div v-if="loading" class="text-[var(--tg-theme-hint-color,#999)]">Загрузка…</div>
      <p v-else-if="giveaways.length === 0" class="text-[var(--tg-theme-hint-color,#999)] text-sm">
        Активных розыгрышей пока нет. Загляните позже!
      </p>
      <ul v-else class="space-y-3">
        <li
          v-for="g in giveaways"
          :key="g.id"
          class="p-4 rounded-xl bg-[var(--tg-theme-secondary-bg-color,#f4f4f5)] active:opacity-90"
          @click="goToGiveaway(g.id)"
        >
          <div class="font-medium">{{ g.title }}</div>
          <div v-if="g.description" class="text-sm text-[var(--tg-theme-hint-color,#999)] line-clamp-2 mt-0.5">
            {{ g.description }}
          </div>
          <div class="text-xs text-[var(--tg-theme-hint-color,#999)] mt-2">
            до {{ g.endAt ? new Date(g.endAt).toLocaleDateString() : '' }}
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
